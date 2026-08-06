import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { buildRoutineImportSourceKey } from "@/lib/services/routine-import/sheet-config";
import { applyRoutineImportBatch } from "@/lib/services/routine-import/staging";
import type { RoutineImportRow } from "@/lib/services/routine-import/types";
import type { RoutineCommandActor } from "@/lib/services/routine/types";

import {
    createRoutineImportRollbackTrigger,
    dropRoutineImportRollbackTrigger,
} from "./mysql-trigger";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function cleanRoutineImportDatabase(): Promise<void> {
    await prisma.notificationOutbox.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.routineOccurrenceAssignee.deleteMany();
    await prisma.routineOccurrence.deleteMany();
    await prisma.routineReminderRule.deleteMany();
    await prisma.routineTaskAssignee.deleteMany();
    await prisma.routineImportRow.deleteMany();
    await prisma.routineImportLedger.deleteMany();
    await prisma.routineTaskCreateIdempotency.deleteMany();
    await prisma.routineTask.deleteMany();
    await prisma.routineImportBatch.deleteMany();
    await prisma.routineCategory.deleteMany();
    await prisma.routineUnit.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function importRow(
    employeeId: number,
    sourceRow: number,
): RoutineImportRow {
    return {
        sourceFileName: "routine-integration.xlsx",
        sourceSheet: "มสช.",
        sourceRow,
        sourceFingerprint: sourceRow.toString(16).padStart(64, "0"),
        sourceCells: [],
        categorySourceText: "บุคลากร",
        ownerSourceText: "ผู้รับผิดชอบ ทดสอบ",
        unitCode: "มสช.",
        unitName: "มสช.",
        categoryName: "บุคลากร",
        title: `งานนำเข้าทดสอบ ${sourceRow}`,
        ownerNames: ["ผู้รับผิดชอบ ทดสอบ"],
        mappedEmployeeIds: [employeeId],
        mappedEmployeeNames: ["ผู้รับผิดชอบ ทดสอบ"],
        mappedAssignees: [{ employeeId, role: "OWNER" }],
        reminderRules: [{
            daysBefore: 1,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: "ASSIGNEES",
            isActive: true,
        }],
        scheduleText: "วันที่ 15 ของเดือน",
        contractText: null,
        extraDetails: null,
        normalizedSchedule: {
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 15, monthOffset: 0 },
            businessDayPolicy: "NONE",
        },
        contractStartDate: null,
        contractEndDate: null,
        requiresReview: false,
        reviewReasons: [],
        proposedActivation: "ACTIVE",
    };
}

interface RoutineImportFixture {
    actor: RoutineCommandActor;
    batchId: number;
    categoryId: number;
    employeeId: number;
}

async function createRoutineImportFixture(rowCount = 1): Promise<RoutineImportFixture> {
    const department = await prisma.department.create({
        data: { name: "แผนกทดสอบ Routine Import", code: "RTN-IMPORT-TEST" },
    });
    const employee = await prisma.employee.create({
        data: {
            firstName: "ผู้รับผิดชอบ",
            lastName: "ทดสอบ",
            email: "routine-owner@integration.test",
            position: "เจ้าหน้าที่ทดสอบ",
            departmentId: department.id,
        },
    });
    const admin = await prisma.user.create({
        data: {
            email: "routine-admin@integration.test",
            name: "ผู้ดูแล Routine Import",
            password: "integration-test-only",
            role: Role.ADMIN,
        },
    });
    await prisma.routineUnit.create({
        data: { code: "มสช.", name: "มสช.", isActive: true },
    });
    const category = await prisma.routineCategory.create({
        data: { name: "บุคลากร", sortOrder: 1, isActive: true },
    });
    const rows = Array.from({ length: rowCount }, (_, index) => {
        const row = importRow(employee.id, 11 + index);
        return {
            sourceSheet: row.sourceSheet,
            sourceRow: row.sourceRow,
            sourceKey: buildRoutineImportSourceKey(row.sourceSheet, row.sourceRow),
            sourceFingerprint: row.sourceFingerprint,
            categoryName: row.categoryName,
            title: row.title,
            ownerNamesText: row.ownerNames.join(", "),
            rawData: toInputJson({ sourceRow: row.sourceRow }),
            normalizedData: toInputJson(row),
            status: "VALID" as const,
            selected: true,
            proposedActivation: "ACTIVE" as const,
            reviewReasons: toInputJson([]),
        };
    });
    const batch = await prisma.routineImportBatch.create({
        data: {
            originalFileName: "routine-integration.xlsx",
            fileHash: "f".repeat(64),
            targetSheet: "มสช.",
            asOfDate: new Date("2026-08-06T00:00:00.000Z"),
            ignoredSheets: toInputJson([]),
            status: "READY",
            uploadedById: admin.id,
            totalRows: rowCount,
            validRows: rowCount,
            selectedRows: rowCount,
            expiresAt: new Date(Date.now() + 60_000),
            rows: { create: rows },
        },
    });
    return {
        actor: {
            id: admin.id,
            email: admin.email,
            role: "ADMIN",
            ipAddress: "127.0.0.1",
            userAgent: "routine-import-integration-test",
            requestId: "routine-import-integration",
            correlationId: "routine-import-integration",
        },
        batchId: batch.id,
        categoryId: category.id,
        employeeId: employee.id,
    };
}

describe.sequential("routine import apply with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await dropRoutineImportRollbackTrigger();
        await cleanRoutineImportDatabase();
    });

    afterAll(async () => {
        await dropRoutineImportRollbackTrigger();
        await cleanRoutineImportDatabase();
        await prisma.$disconnect();
    });

    it("creates the complete Routine graph, ledger, counts, result summary, and audit", async () => {
        const fixture = await createRoutineImportFixture();

        const result = await applyRoutineImportBatch(fixture.batchId, fixture.actor);

        expect(result).toMatchObject({
            idempotent: false,
            importedCount: 1,
            skippedCount: 0,
            appliedBy: {
                userId: fixture.actor.id,
                email: fixture.actor.email,
            },
        });
        expect(result.importedTaskIds).toHaveLength(1);
        expect(result.importedRowIds).toHaveLength(1);
        expect(await prisma.routineTask.count()).toBe(1);
        expect(await prisma.routineTaskAssignee.count()).toBe(1);
        expect(await prisma.routineReminderRule.count()).toBe(1);
        expect(await prisma.routineOccurrence.count()).toBeGreaterThan(0);
        expect(await prisma.routineOccurrenceAssignee.count()).toBe(
            await prisma.routineOccurrence.count(),
        );
        expect(await prisma.routineImportLedger.count()).toBe(1);
        expect(await prisma.routineImportRow.findFirstOrThrow()).toMatchObject({
            status: "APPLIED",
            appliedTaskId: result.importedTaskIds[0],
        });
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({
            status: "COMPLETED",
            validRows: 0,
            appliedRows: 1,
            selectedRows: 1,
        });
        const applyAudit = await prisma.auditLog.findFirstOrThrow({
            where: { action: "ROUTINE_IMPORT_APPLY", entityId: fixture.batchId },
        });
        expect(JSON.parse(applyAudit.details ?? "{}")).toMatchObject({
            batchId: fixture.batchId,
            taskIds: result.importedTaskIds,
            importedRowIds: result.importedRowIds,
            appliedRows: 1,
        });
    });

    it("rolls back every row and retries safely after a controlled second-row failure", async () => {
        const fixture = await createRoutineImportFixture(2);
        await createRoutineImportRollbackTrigger();

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toBeDefined();

        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineTaskAssignee.count()).toBe(0);
        expect(await prisma.routineReminderRule.count()).toBe(0);
        expect(await prisma.routineOccurrence.count()).toBe(0);
        expect(await prisma.routineOccurrenceAssignee.count()).toBe(0);
        expect(await prisma.routineImportLedger.count()).toBe(0);
        expect(await prisma.routineImportRow.findMany({
            orderBy: { sourceRow: "asc" },
            select: { status: true, appliedTaskId: true },
        })).toEqual([
            { status: "VALID", appliedTaskId: null },
            { status: "VALID", appliedTaskId: null },
        ]);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "READY", appliedRows: 0, validRows: 2 });

        await dropRoutineImportRollbackTrigger();
        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).resolves.toMatchObject({ importedCount: 2, idempotent: false });
        expect(await prisma.routineTask.count()).toBe(2);
        expect(await prisma.routineImportLedger.count()).toBe(2);
    });

    it("allows only one concurrent Apply request to create data", async () => {
        const fixture = await createRoutineImportFixture();

        const results = await Promise.allSettled([
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
        expect(await prisma.routineTask.count()).toBe(1);
        expect(await prisma.routineImportLedger.count()).toBe(1);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "COMPLETED", appliedRows: 1 });
    });

    it("uses selected rows as source of truth instead of stale batch counters", async () => {
        const fixture = await createRoutineImportFixture();
        await prisma.routineImportRow.updateMany({
            where: { batchId: fixture.batchId },
            data: { selected: false },
        });

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toThrow("อย่างน้อย 1 รายการ");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "READY", selectedRows: 1 });
    });

    it("rejects a selected review row before claiming the batch", async () => {
        const fixture = await createRoutineImportFixture();
        const reviewRow = {
            ...importRow(fixture.employeeId, 11),
            requiresReview: true,
            reviewReasons: ["MISSING_OWNER"],
        } satisfies RoutineImportRow;
        await prisma.routineImportRow.updateMany({
            where: { batchId: fixture.batchId },
            data: {
                status: "REQUIRES_REVIEW",
                selected: true,
                reviewReasons: toInputJson(reviewRow.reviewReasons),
                normalizedData: toInputJson(reviewRow),
            },
        });

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toThrow("ตรวจสอบ");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "READY", appliedRows: 0 });
    });

    it("commits EXPIRED without creating partial data", async () => {
        const fixture = await createRoutineImportFixture();
        await prisma.routineImportBatch.update({
            where: { id: fixture.batchId },
            data: { expiresAt: new Date(Date.now() - 1_000) },
        });

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toThrow("หมดอายุ");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "EXPIRED", appliedRows: 0 });
    });

    it("applies a medium 50-row batch without changing transaction semantics", async () => {
        const fixture = await createRoutineImportFixture(50);

        const result = await applyRoutineImportBatch(fixture.batchId, fixture.actor);

        expect(result).toMatchObject({
            idempotent: false,
            importedCount: 50,
            skippedCount: 0,
        });
        expect(await prisma.routineTask.count()).toBe(50);
        expect(await prisma.routineTaskAssignee.count()).toBe(50);
        expect(await prisma.routineReminderRule.count()).toBe(50);
        expect(await prisma.routineImportLedger.count()).toBe(50);
        expect(await prisma.routineImportRow.count({
            where: { batchId: fixture.batchId, status: "APPLIED" },
        })).toBe(50);
    });

    it("rejects an employee that became inactive before Apply without partial data", async () => {
        const fixture = await createRoutineImportFixture();
        await prisma.employee.update({
            where: { id: fixture.employeeId },
            data: { status: "INACTIVE" },
        });

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toThrow("ผู้รับผิดชอบ");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportLedger.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "READY", appliedRows: 0 });
    });

    it("rejects a category that became inactive before Apply without partial data", async () => {
        const fixture = await createRoutineImportFixture();
        await prisma.routineCategory.update({
            where: { id: fixture.categoryId },
            data: { isActive: false },
        });

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toThrow("หมวดหมู่");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportLedger.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "READY", appliedRows: 0 });
    });

    it("rejects a unit that became inactive before Apply without partial data", async () => {
        const fixture = await createRoutineImportFixture();
        await prisma.routineUnit.update({
            where: { code: "มสช." },
            data: { isActive: false },
        });

        await expect(
            applyRoutineImportBatch(fixture.batchId, fixture.actor),
        ).rejects.toThrow("หน่วยงาน");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportLedger.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: fixture.batchId },
        })).toMatchObject({ status: "READY", appliedRows: 0 });
    });

    it("rejects duplicate source ledger and a repeated Apply after completion safely", async () => {
        const duplicateFixture = await createRoutineImportFixture();
        const duplicateRow = await prisma.routineImportRow.findFirstOrThrow({
            where: { batchId: duplicateFixture.batchId },
        });
        await prisma.routineImportLedger.create({
            data: {
                sourceFileName: "routine-integration.xlsx",
                sourceSheet: duplicateRow.sourceSheet,
                sourceRow: duplicateRow.sourceRow,
                sourceFingerprint: duplicateRow.sourceFingerprint,
                status: "APPLIED",
                appliedById: duplicateFixture.actor.id,
            },
        });

        await expect(
            applyRoutineImportBatch(duplicateFixture.batchId, duplicateFixture.actor),
        ).rejects.toThrow("ถูกนำเข้าแล้ว");
        expect(await prisma.routineTask.count()).toBe(0);

        await cleanRoutineImportDatabase();
        const completedFixture = await createRoutineImportFixture();
        await applyRoutineImportBatch(completedFixture.batchId, completedFixture.actor);
        await expect(
            applyRoutineImportBatch(completedFixture.batchId, completedFixture.actor),
        ).rejects.toThrow("เสร็จแล้ว");
        expect(await prisma.routineTask.count()).toBe(1);
        expect(await prisma.routineImportLedger.count()).toBe(1);
    });

    it("rejects changed fingerprints and source-row conflicts before creating tasks", async () => {
        const mismatchFixture = await createRoutineImportFixture();
        const mismatchRow = await prisma.routineImportRow.findFirstOrThrow({
            where: { batchId: mismatchFixture.batchId },
        });
        const normalized = importRow(mismatchFixture.employeeId, mismatchRow.sourceRow);
        await prisma.routineImportRow.update({
            where: { id: mismatchRow.id },
            data: {
                normalizedData: toInputJson({
                    ...normalized,
                    sourceFingerprint: "e".repeat(64),
                }),
            },
        });

        await expect(
            applyRoutineImportBatch(mismatchFixture.batchId, mismatchFixture.actor),
        ).rejects.toThrow("ไม่ตรงกับ staging");
        expect(await prisma.routineTask.count()).toBe(0);

        await cleanRoutineImportDatabase();
        const conflictFixture = await createRoutineImportFixture();
        const conflictRow = await prisma.routineImportRow.findFirstOrThrow({
            where: { batchId: conflictFixture.batchId },
        });
        await prisma.routineImportLedger.create({
            data: {
                sourceFileName: "ไฟล์ก่อนหน้า.xlsx",
                sourceSheet: conflictRow.sourceSheet,
                sourceRow: conflictRow.sourceRow,
                sourceFingerprint: "d".repeat(64),
                status: "APPLIED",
                appliedById: conflictFixture.actor.id,
            },
        });

        await expect(
            applyRoutineImportBatch(conflictFixture.batchId, conflictFixture.actor),
        ).rejects.toThrow("source conflict");
        expect(await prisma.routineTask.count()).toBe(0);
        expect(await prisma.routineImportBatch.findUniqueOrThrow({
            where: { id: conflictFixture.batchId },
        })).toMatchObject({ status: "READY", appliedRows: 0 });
    });
});
