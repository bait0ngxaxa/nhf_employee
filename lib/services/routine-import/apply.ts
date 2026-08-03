import type {
    Prisma,
    RoutineImportStatus as PrismaRoutineImportStatus,
} from "@prisma/client";

import { runSerializableTransaction, hasPrismaErrorCode } from "@/lib/db/transaction";
import { routineTaskCreateSchema, type RoutineTaskCreateInput } from "@/lib/validations/routine";

import { ROUTINE_IMPORT_CATEGORY_SORT_ORDER } from "./constants";
import { createRoutineTaskInTransaction } from "../routine/mutations";
import type { RoutineCommandActor } from "../routine/types";
import {
    assertRoutineImportManifestApplySafe,
} from "./validation";
import type {
    RoutineImportApplyResult,
    RoutineImportManifest,
    RoutineImportRow,
} from "./types";

function taskInputForRow(
    row: RoutineImportRow,
    unitId: number,
    categoryId: number,
): RoutineTaskCreateInput {
    const parsed = routineTaskCreateSchema.safeParse({
        unitId,
        categoryId,
        title: row.title,
        description: null,
        scheduleType: row.normalizedSchedule?.scheduleType ?? "MANUAL",
        scheduleConfig: row.normalizedSchedule?.scheduleConfig ?? {},
        scheduleText: row.scheduleText,
        contractStartDate: row.contractStartDate,
        contractEndDate: row.contractEndDate,
        contractText: row.contractText,
        extraDetails: row.extraDetails,
        businessDayPolicy: row.normalizedSchedule?.businessDayPolicy ?? "NONE",
        isActive: row.proposedActivation === "ACTIVE",
        assignees: row.mappedEmployeeIds.map((employeeId, index) => ({
            employeeId,
            role: index === 0 ? "OWNER" : "CO_OWNER",
        })),
        sourceFileName: row.sourceFileName,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
    });
    if (!parsed.success) {
        throw new Error("ข้อมูล row ไม่ผ่าน validation ของ RoutineTask");
    }
    return parsed.data;
}

export function buildRoutineImportTaskInput(
    row: RoutineImportRow,
    unitId: number,
    categoryId: number,
): RoutineTaskCreateInput {
    return taskInputForRow(row, unitId, categoryId);
}

type RoutineImportRowResult =
    | "inserted"
    | "skipped"
    | "conflict"
    | "historyOnly"
    | "inactive";

async function applyRoutineImportRowInTransaction(
    tx: Prisma.TransactionClient,
    row: RoutineImportRow,
    actor: RoutineCommandActor,
): Promise<RoutineImportRowResult> {
    const existingLedger = await tx.routineImportLedger.findUnique({
        where: {
            sourceFileName_sourceSheet_sourceRow: {
                sourceFileName: row.sourceFileName,
                sourceSheet: row.sourceSheet,
                sourceRow: row.sourceRow,
            },
        },
        select: {
            id: true,
            sourceFingerprint: true,
            status: true,
            taskId: true,
        },
    });
    if (existingLedger) {
        if (existingLedger.sourceFingerprint !== row.sourceFingerprint) {
            await tx.routineImportLedger.update({
                where: { id: existingLedger.id },
                data: {
                    status: "CONFLICT" satisfies PrismaRoutineImportStatus,
                    resolutionNote: "source fingerprint เปลี่ยนจาก manifest เดิม",
                },
            });
            return "conflict";
        }
        return existingLedger.status === "CONFLICT"
            ? "conflict"
            : existingLedger.status === "SKIPPED" || existingLedger.taskId !== null
                ? "skipped"
                : "conflict";
    }

    const existingTask = await tx.routineTask.findFirst({
        where: {
            sourceFileName: row.sourceFileName,
            sourceSheet: row.sourceSheet,
            sourceRow: row.sourceRow,
        },
        select: { id: true },
    });
    if (existingTask) {
        await tx.routineImportLedger.create({
            data: {
                sourceFileName: row.sourceFileName,
                sourceSheet: row.sourceSheet,
                sourceRow: row.sourceRow,
                sourceFingerprint: row.sourceFingerprint,
                status: "CONFLICT" satisfies PrismaRoutineImportStatus,
                taskId: existingTask.id,
                resolutionNote: "พบ RoutineTask เดิมที่มี source identity เดียวกัน",
            },
        });
        return "conflict";
    }

    if (row.proposedActivation === "HISTORY_ONLY") {
        await tx.routineImportLedger.create({
            data: {
                sourceFileName: row.sourceFileName,
                sourceSheet: row.sourceSheet,
                sourceRow: row.sourceRow,
                sourceFingerprint: row.sourceFingerprint,
                status: "SKIPPED" satisfies PrismaRoutineImportStatus,
                resolutionNote: row.reviewReasons.join(","),
                appliedById: actor.id,
            },
        });
        return "historyOnly";
    }

    if (row.mappedEmployeeIds.length === 0) {
        throw new Error("ไม่สามารถสร้าง task โดยไม่มีผู้รับผิดชอบ");
    }

    const unit = await tx.routineUnit.upsert({
        where: { code: row.unitCode },
        update: { name: row.unitName },
        create: { code: row.unitCode, name: row.unitName, isActive: true },
        select: { id: true },
    });
    const category = await tx.routineCategory.upsert({
        where: { name: row.categoryName },
        update: { name: row.categoryName },
        create: {
            name: row.categoryName,
            sortOrder: ROUTINE_IMPORT_CATEGORY_SORT_ORDER[row.categoryName] ?? 99,
            isActive: true,
        },
        select: { id: true },
    });
    const task = await createRoutineTaskInTransaction(
        tx,
        taskInputForRow(row, unit.id, category.id),
        actor,
    );
    await tx.routineImportLedger.create({
        data: {
            sourceFileName: row.sourceFileName,
            sourceSheet: row.sourceSheet,
            sourceRow: row.sourceRow,
            sourceFingerprint: row.sourceFingerprint,
            status: "APPLIED" satisfies PrismaRoutineImportStatus,
            taskId: task.id,
            appliedById: actor.id,
            resolutionNote: row.proposedActivation === "INACTIVE"
                ? row.reviewReasons.join(",")
                : null,
        },
    });
    return row.proposedActivation === "INACTIVE" ? "inactive" : "inserted";
}

function safeApplyError(error: unknown): string {
    if (hasPrismaErrorCode(error, "P2002")) {
        return "source identity ซ้ำหรือถูกใช้โดย import อื่น";
    }
    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }
    return "ไม่สามารถ apply row ได้";
}

export async function applyRoutineImportManifest(
    manifest: RoutineImportManifest,
    actor: RoutineCommandActor,
): Promise<RoutineImportApplyResult> {
    assertRoutineImportManifestApplySafe(manifest);
    const result: RoutineImportApplyResult = {
        inserted: 0,
        skipped: 0,
        conflicts: 0,
        failed: 0,
        historyOnly: 0,
        inactive: 0,
        errors: [],
    };

    for (const row of manifest.rows) {
        try {
            const rowResult = await runSerializableTransaction((tx) =>
                applyRoutineImportRowInTransaction(tx, row, actor),
            );
            if (rowResult === "inserted") result.inserted += 1;
            if (rowResult === "skipped") result.skipped += 1;
            if (rowResult === "conflict") result.conflicts += 1;
            if (rowResult === "historyOnly") result.historyOnly += 1;
            if (rowResult === "inactive") result.inactive += 1;
        } catch (error: unknown) {
            result.failed += 1;
            result.errors.push({
                sourceSheet: row.sourceSheet,
                sourceRow: row.sourceRow,
                title: row.title,
                reason: safeApplyError(error),
            });
        }
    }
    return result;
}
