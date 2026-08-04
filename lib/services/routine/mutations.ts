import type {
    Prisma,
    RoutineAssigneeRole as PrismaRoutineAssigneeRole,
    RoutineBusinessDayPolicy as PrismaRoutineBusinessDayPolicy,
    RoutineReminderChannel as PrismaRoutineReminderChannel,
    RoutineReminderRecipientScope as PrismaRoutineReminderRecipientScope,
    RoutineScheduleType as PrismaRoutineScheduleType,
} from "@prisma/client";
import { ZodError } from "zod";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { hasPrismaErrorCode } from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";
import {
    calendarDateToDate,
    isCalendarDate,
    toBangkokCalendarDate,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";
import {
    parseRoutineScheduleConfig,
    type RoutineDueDateInput,
    type RoutineOccurrenceAssigneesInput,
    type RoutineOccurrenceOverrideInput,
    type RoutineReminderRuleInput,
    type RoutineTaskCreateInput,
    type RoutineTaskUpdateInput,
} from "@/lib/validations/routine";

import { createRoutineAuditInTransaction } from "./audit";
import {
    assertActiveAdminInTransaction,
    assertActiveEmployeesInTransaction,
} from "./authorization";
import {
    assertMatchingRoutineTaskIdempotency,
    createRoutineTaskRequestHash,
} from "./idempotency";
import {
    RoutineConflictError,
    RoutineNotFoundError,
    RoutineValidationError,
} from "./errors";
import {
    generateRoutineTaskOccurrencesInTransaction,
    type RoutineGenerationOptions,
} from "./generation";
import type { RoutineCommandActor } from "./types";

const ROUTINE_TASK_INCLUDE = {
    unit: { select: { id: true, code: true, name: true, isActive: true } },
    category: {
        select: { id: true, name: true, sortOrder: true, isActive: true },
    },
    assignees: {
        select: {
            employeeId: true,
            role: true,
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    status: true,
                    deletedAt: true,
                },
            },
        },
    },
    reminderRules: {
        select: {
            id: true,
            daysBefore: true,
            sendHour: true,
            channel: true,
            recipientScope: true,
            isActive: true,
        },
        orderBy: [{ daysBefore: "asc" }, { sendHour: "asc" }],
    },
} as const satisfies Prisma.RoutineTaskInclude;

const ROUTINE_OCCURRENCE_INCLUDE = {
    task: {
        select: {
            id: true,
            title: true,
            description: true,
            scheduleType: true,
            scheduleText: true,
            isActive: true,
            unit: { select: { id: true, code: true, name: true } },
            category: { select: { id: true, name: true } },
        },
    },
    assignees: {
        select: {
            employeeId: true,
            role: true,
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    status: true,
                    deletedAt: true,
                },
            },
        },
    },
} as const satisfies Prisma.RoutineOccurrenceInclude;

type RoutineAssigneeInput = {
    employeeId: number;
    role: "OWNER" | "CO_OWNER";
};

type RoutineReminderRuleRecord = {
    daysBefore: number;
    sendHour: number;
    channel: string;
    recipientScope: string;
    isActive: boolean;
};

function normalizeReminderRules(
    rules: readonly RoutineReminderRuleInput[] | undefined,
): Array<{
    daysBefore: number;
    sendHour: number;
    channel: PrismaRoutineReminderChannel;
    recipientScope: PrismaRoutineReminderRecipientScope;
    isActive: boolean;
}> {
    return (rules ?? []).map((rule) => ({
        daysBefore: rule.daysBefore,
        sendHour: rule.sendHour,
        channel: rule.channel as PrismaRoutineReminderChannel,
        recipientScope: rule.recipientScope as PrismaRoutineReminderRecipientScope,
        isActive: rule.isActive,
    }));
}

function areReminderRulesEqual(
    current: readonly RoutineReminderRuleRecord[],
    next: readonly RoutineReminderRuleRecord[],
): boolean {
    if (current.length !== next.length) return false;

    const toKey = (rule: RoutineReminderRuleRecord): string =>
        [
            rule.daysBefore,
            rule.sendHour,
            rule.channel,
            rule.recipientScope,
            rule.isActive,
        ].join(":");

    const currentKeys = current.map(toKey).sort();
    const nextKeys = next.map(toKey).sort();
    return currentKeys.every((key, index) => key === nextKeys[index]);
}

function areAssigneesEqual(
    current: readonly { employeeId: number; role: string }[],
    next: readonly { employeeId: number; role: string }[],
): boolean {
    if (current.length !== next.length) return false;

    const toKey = (assignee: { employeeId: number; role: string }): string =>
        `${assignee.employeeId}:${assignee.role}`;
    const currentKeys = current.map(toKey).sort();
    const nextKeys = next.map(toKey).sort();
    return currentKeys.every((key, index) => key === nextKeys[index]);
}

function normalizeAssignees(
    assignees: readonly RoutineAssigneeInput[],
): Array<{ employeeId: number; role: PrismaRoutineAssigneeRole }> {
    const employeeIds = new Set<number>();
    let ownerCount = 0;
    const normalized = assignees.map((assignee) => {
        if (employeeIds.has(assignee.employeeId)) {
            throw new RoutineValidationError("ผู้รับผิดชอบซ้ำกันไม่ได้");
        }
        employeeIds.add(assignee.employeeId);
        if (assignee.role === "OWNER") ownerCount += 1;
        return {
            employeeId: assignee.employeeId,
            role: assignee.role as PrismaRoutineAssigneeRole,
        };
    });
    if (ownerCount !== 1) {
        throw new RoutineValidationError("ต้องมีผู้รับผิดชอบหลัก 1 คน");
    }
    return normalized;
}

function parseScheduleConfig(
    scheduleType: RoutineScheduleType,
    value: unknown,
): Prisma.InputJsonValue {
    try {
        return parseRoutineScheduleConfig(scheduleType, value) as Prisma.InputJsonValue;
    } catch (error) {
        if (error instanceof ZodError) {
            throw new RoutineValidationError(
                "กำหนดค่าตารางงานประจำไม่ถูกต้อง",
            );
        }
        throw error;
    }
}

function ensureContractRange(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
): void {
    if (startDate && endDate && startDate > endDate) {
        throw new RoutineValidationError(
            "วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา",
        );
    }
}

async function assertActiveRoutineReferences(
    tx: Prisma.TransactionClient,
    unitId: number,
    categoryId: number,
): Promise<void> {
    const unit = await tx.routineUnit.findFirst({
        where: { id: unitId, isActive: true },
        select: { id: true },
    });
    const category = await tx.routineCategory.findFirst({
        where: { id: categoryId, isActive: true },
        select: { id: true },
    });
    if (!unit || !category) {
        throw new RoutineValidationError("หน่วยงานหรือหมวดหมู่ไม่พร้อมใช้งาน");
    }
}

function taskAuditSnapshot(task: {
    id: number;
    unitId: number;
    categoryId: number;
    title: string;
    scheduleType: string;
    businessDayPolicy: string;
    isActive: boolean;
    version: number;
    contractStartDate: Date | null;
    contractEndDate: Date | null;
}): Record<string, unknown> {
    return {
        taskId: task.id,
        unitId: task.unitId,
        categoryId: task.categoryId,
        title: task.title,
        scheduleType: task.scheduleType,
        businessDayPolicy: task.businessDayPolicy,
        isActive: task.isActive,
        version: task.version,
        contractStartDate: task.contractStartDate
            ? toBangkokCalendarDate(task.contractStartDate)
            : null,
        contractEndDate: task.contractEndDate
            ? toBangkokCalendarDate(task.contractEndDate)
            : null,
    };
}

export async function createRoutineTaskInTransaction(
    tx: Prisma.TransactionClient,
    input: RoutineTaskCreateInput,
    actor: RoutineCommandActor,
    generationOptions: RoutineGenerationOptions = {},
): Promise<Prisma.RoutineTaskGetPayload<{ include: typeof ROUTINE_TASK_INCLUDE }>> {
    const scheduleType = input.scheduleType as RoutineScheduleType;
    const scheduleConfig = parseScheduleConfig(scheduleType, input.scheduleConfig);
    ensureContractRange(input.contractStartDate, input.contractEndDate);
    const assignees = normalizeAssignees(input.assignees);

    await assertActiveAdminInTransaction(tx, actor);
    await assertActiveRoutineReferences(tx, input.unitId, input.categoryId);
    await assertActiveEmployeesInTransaction(
        tx,
        assignees.map((assignee) => assignee.employeeId),
    );

    const task = await tx.routineTask.create({
        data: {
            unitId: input.unitId,
            categoryId: input.categoryId,
            title: input.title,
            description: input.description ?? null,
            scheduleType: scheduleType as PrismaRoutineScheduleType,
            scheduleConfig,
            scheduleText: input.scheduleText ?? null,
            contractStartDate: input.contractStartDate
                ? calendarDateToDate(input.contractStartDate)
                : null,
            contractEndDate: input.contractEndDate
                ? calendarDateToDate(input.contractEndDate)
                : null,
            contractText: input.contractText ?? null,
            extraDetails: input.extraDetails ?? null,
            businessDayPolicy: input.businessDayPolicy as PrismaRoutineBusinessDayPolicy,
            isActive: input.isActive,
            sourceFileName: input.sourceFileName ?? null,
            sourceSheet: input.sourceSheet ?? null,
            sourceRow: input.sourceRow ?? null,
            createdById: actor.id,
            updatedById: actor.id,
            assignees: { create: assignees },
            ...(input.reminderRules !== undefined
                ? {
                      reminderRules: {
                          create: normalizeReminderRules(input.reminderRules),
                      },
                  }
                : {}),
        },
    });

    await createRoutineAuditInTransaction(
        tx,
        "ROUTINE_TASK_CREATE",
        "RoutineTask",
        task.id,
        actor,
        {
            taskId: task.id,
            affectedEmployeeIds: assignees.map((assignee) => assignee.employeeId),
            scheduleType,
            version: task.version,
        },
    );
    await generateRoutineTaskOccurrencesInTransaction(
        tx,
        task.id,
        new Date(),
        generationOptions,
    );

    return tx.routineTask.findUniqueOrThrow({
        where: { id: task.id },
        include: ROUTINE_TASK_INCLUDE,
    });
}

export async function createRoutineTask(
    input: RoutineTaskCreateInput,
    actor: RoutineCommandActor,
    options: { idempotencyKey: string },
): Promise<{
    task: Prisma.RoutineTaskGetPayload<{ include: typeof ROUTINE_TASK_INCLUDE }>;
    replayed: boolean;
}> {
    const requestHash = createRoutineTaskRequestHash(input);

    class RoutineIdempotencyRaceError extends Error {}

    try {
        return await runSerializableTransaction(async (tx) => {
            await assertActiveAdminInTransaction(tx, actor);
            const existing = await tx.routineTaskCreateIdempotency.findUnique({
                where: {
                    userId_idempotencyKey: {
                        userId: actor.id,
                        idempotencyKey: options.idempotencyKey,
                    },
                },
            });
            if (existing) {
                assertMatchingRoutineTaskIdempotency(
                    requestHash,
                    existing.requestHash,
                );
                const task = await tx.routineTask.findUnique({
                    where: { id: existing.taskId },
                    include: ROUTINE_TASK_INCLUDE,
                });
                if (!task) {
                    throw new RoutineConflictError(
                        "ไม่พบผลลัพธ์ของคำขอสร้าง Routine เดิม",
                    );
                }
                return { task, replayed: true };
            }

            const task = await createRoutineTaskInTransaction(tx, input, actor);
            try {
                await tx.routineTaskCreateIdempotency.create({
                    data: {
                        userId: actor.id,
                        idempotencyKey: options.idempotencyKey,
                        requestHash,
                        taskId: task.id,
                    },
                });
            } catch (error) {
                if (hasPrismaErrorCode(error, "P2002")) {
                    throw new RoutineIdempotencyRaceError();
                }
                throw error;
            }
            return { task, replayed: false };
        });
    } catch (error) {
        if (!(error instanceof RoutineIdempotencyRaceError)) throw error;

        const existing = await prisma.routineTaskCreateIdempotency.findUnique({
            where: {
                userId_idempotencyKey: {
                    userId: actor.id,
                    idempotencyKey: options.idempotencyKey,
                },
            },
        });
        if (!existing) throw error;
        assertMatchingRoutineTaskIdempotency(requestHash, existing.requestHash);
        const task = await prisma.routineTask.findUnique({
            where: { id: existing.taskId },
            include: ROUTINE_TASK_INCLUDE,
        });
        if (!task) {
            throw new RoutineConflictError(
                "ไม่พบผลลัพธ์ของคำขอสร้าง Routine เดิม",
            );
        }
        return { task, replayed: true };
    }
}

export async function deleteRoutineTask(
    taskId: number,
    actor: RoutineCommandActor,
): Promise<void> {
    await runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const task = await tx.routineTask.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                title: true,
                version: true,
            },
        });
        if (!task) throw new RoutineNotFoundError();

        const occurrences = await tx.routineOccurrence.findMany({
            where: { taskId },
            select: { id: true },
        });
        const occurrenceIds = occurrences.map((occurrence) => occurrence.id);
        if (occurrenceIds.length > 0) {
            const prefixes = occurrenceIds.map((occurrenceId) =>
                `routine:${occurrenceId}:`,
            );
            const pendingOutbox = await tx.notificationOutbox.findMany({
                where: {
                    type: "ROUTINE_REMINDER_IN_APP",
                    status: { in: ["PENDING", "PROCESSING", "FAILED"] },
                    OR: prefixes.map((prefix) => ({
                        eventKey: { startsWith: prefix },
                    })),
                },
                select: { id: true, eventKey: true },
            });
            const outboxIds = pendingOutbox.map((row) => row.id);
            if (outboxIds.length > 0) {
                await tx.notificationOutbox.updateMany({
                    where: {
                        id: { in: outboxIds },
                        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
                    },
                    data: {
                        status: "SUPERSEDED",
                        lastError: "Routine task was deleted",
                    },
                });
            }
            await tx.routineOccurrenceAssignee.deleteMany({
                where: { occurrenceId: { in: occurrenceIds } },
            });
            await tx.routineOccurrence.deleteMany({ where: { taskId } });
        }

        await tx.routineTaskAssignee.deleteMany({ where: { taskId } });
        await tx.routineReminderRule.deleteMany({ where: { taskId } });
        await tx.routineImportRow.updateMany({
            where: { appliedTaskId: taskId },
            data: { appliedTaskId: null },
        });
        await tx.routineImportLedger.updateMany({
            where: { taskId },
            data: { taskId: null },
        });
        await tx.routineTaskCreateIdempotency.deleteMany({
            where: { taskId },
        });

        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_TASK_DELETE",
            "RoutineTask",
            taskId,
            actor,
            { taskId, title: task.title, version: task.version },
        );
        await tx.routineTask.delete({ where: { id: taskId } });
    });
}

export async function updateRoutineTask(
    taskId: number,
    input: RoutineTaskUpdateInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineTaskGetPayload<{ include: typeof ROUTINE_TASK_INCLUDE }>> {
    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const current = await tx.routineTask.findUnique({
            where: { id: taskId },
            include: ROUTINE_TASK_INCLUDE,
        });
        if (!current) throw new RoutineNotFoundError();

        const nextScheduleType = (input.scheduleType
            ?? current.scheduleType) as RoutineScheduleType;
        const nextScheduleConfig = parseScheduleConfig(
            nextScheduleType,
            input.scheduleConfig !== undefined
                ? input.scheduleConfig
                : current.scheduleConfig,
        );
        const nextContractStartDate = input.contractStartDate === undefined
            ? (current.contractStartDate
                ? toBangkokCalendarDate(current.contractStartDate)
                : undefined)
            : input.contractStartDate;
        const nextContractEndDate = input.contractEndDate === undefined
            ? (current.contractEndDate
                ? toBangkokCalendarDate(current.contractEndDate)
                : undefined)
            : input.contractEndDate;
        ensureContractRange(nextContractStartDate, nextContractEndDate);

        const nextUnitId = input.unitId ?? current.unitId;
        const nextCategoryId = input.categoryId ?? current.categoryId;
        await assertActiveRoutineReferences(tx, nextUnitId, nextCategoryId);

        const nextAssignees = input.assignees
            ? normalizeAssignees(input.assignees)
            : null;
        const nextReminderRules = input.reminderRules !== undefined
            ? normalizeReminderRules(input.reminderRules)
            : null;
        const assigneesChanged = nextAssignees !== null
            && !areAssigneesEqual(current.assignees, nextAssignees);
        const reminderRulesChanged =
            nextReminderRules !== null
            && !areReminderRulesEqual(current.reminderRules, nextReminderRules);
        const isActiveChanged =
            input.isActive !== undefined && input.isActive !== current.isActive;
        if (nextAssignees) {
            await assertActiveEmployeesInTransaction(
                tx,
                nextAssignees.map((assignee) => assignee.employeeId),
            );
        }

        const data: Prisma.RoutineTaskUncheckedUpdateInput = {
            unitId: input.unitId,
            categoryId: input.categoryId,
            title: input.title,
            description: input.description,
            scheduleType: nextScheduleType as PrismaRoutineScheduleType,
            scheduleConfig: nextScheduleConfig,
            scheduleText: input.scheduleText,
            contractStartDate: input.contractStartDate === undefined
                ? undefined
                : input.contractStartDate
                    ? calendarDateToDate(input.contractStartDate)
                    : null,
            contractEndDate: input.contractEndDate === undefined
                ? undefined
                : input.contractEndDate
                    ? calendarDateToDate(input.contractEndDate)
                    : null,
            contractText: input.contractText,
            extraDetails: input.extraDetails,
            businessDayPolicy: input.businessDayPolicy as PrismaRoutineBusinessDayPolicy | undefined,
            isActive: input.isActive,
            sourceFileName: input.sourceFileName,
            sourceSheet: input.sourceSheet,
            sourceRow: input.sourceRow,
            updatedById: actor.id,
            version: { increment: 1 },
        };

        const updated = await tx.routineTask.updateMany({
            where: { id: taskId, version: input.version },
            data,
        });
        if (updated.count !== 1) {
            throw new RoutineConflictError(
                "ข้อมูลแม่แบบงานเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }

        if (nextAssignees) {
            await tx.routineTaskAssignee.deleteMany({ where: { taskId } });
            await tx.routineTaskAssignee.createMany({
                data: nextAssignees.map((assignee) => ({
                    taskId,
                    employeeId: assignee.employeeId,
                    role: assignee.role,
                })),
            });
        }

        if (nextReminderRules !== null && reminderRulesChanged) {
            await tx.routineReminderRule.deleteMany({ where: { taskId } });
            if (nextReminderRules.length > 0) {
                const reminderRuleTimestamp = new Date();
                await tx.routineReminderRule.createMany({
                    data: nextReminderRules.map((rule) => ({
                        taskId,
                        createdAt: reminderRuleTimestamp,
                        updatedAt: reminderRuleTimestamp,
                        ...rule,
                    })),
                });
            }
        }

        if (assigneesChanged || reminderRulesChanged || isActiveChanged) {
            await tx.routineOccurrence.updateMany({
                where: { taskId },
                data: { reminderVersion: { increment: 1 } },
            });
        }

        const updatedTask = await tx.routineTask.findUniqueOrThrow({
            where: { id: taskId },
        });
        const auditAction = current.isActive && !updatedTask.isActive
            ? "ROUTINE_TASK_DEACTIVATE"
            : "ROUTINE_TASK_UPDATE";
        await createRoutineAuditInTransaction(
            tx,
            auditAction,
            "RoutineTask",
            taskId,
            actor,
            {
                taskId,
                before: taskAuditSnapshot(current),
                after: taskAuditSnapshot(updatedTask),
                affectedEmployeeIds: nextAssignees?.map(
                    (assignee) => assignee.employeeId,
                ) ?? current.assignees.map((assignee) => assignee.employeeId),
                assigneesChanged,
                reminderRulesChanged,
                isActiveChanged,
            },
        );
        await generateRoutineTaskOccurrencesInTransaction(tx, taskId, undefined, {
            previousAssignees: assigneesChanged ? current.assignees : undefined,
        });

        return tx.routineTask.findUniqueOrThrow({
            where: { id: taskId },
            include: ROUTINE_TASK_INCLUDE,
        });
    });
}

async function findOccurrenceForMutation(
    tx: Prisma.TransactionClient,
    occurrenceId: number,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    const occurrence = await tx.routineOccurrence.findUnique({
        where: { id: occurrenceId },
        include: ROUTINE_OCCURRENCE_INCLUDE,
    });
    if (!occurrence) throw new RoutineNotFoundError();
    if (!occurrence.task.isActive) throw new RoutineNotFoundError();
    return occurrence;
}

export async function updateRoutineOccurrenceOverride(
    occurrenceId: number,
    input: RoutineOccurrenceOverrideInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    if (!isCalendarDate(input.dueDate)) {
        throw new RoutineValidationError("รูปแบบวันกำหนดไม่ถูกต้อง");
    }
    const assignees = normalizeAssignees(input.assignees);

    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const occurrence = await findOccurrenceForMutation(tx, occurrenceId);
        if (
            input.expectedReminderVersion !== undefined
            && input.expectedReminderVersion !== occurrence.reminderVersion
        ) {
            throw new RoutineConflictError(
                "ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }
        await assertActiveEmployeesInTransaction(
            tx,
            assignees.map((assignee) => assignee.employeeId),
        );

        const oldDueDate = toBangkokCalendarDate(occurrence.dueDate);
        const dueDateChanged = oldDueDate !== input.dueDate;
        const assigneesChanged = !areAssigneesEqual(occurrence.assignees, assignees);
        if (!dueDateChanged && !assigneesChanged) return occurrence;

        const claimed = await tx.routineOccurrence.updateMany({
            where: {
                id: occurrenceId,
                ...(input.expectedReminderVersion !== undefined
                    ? { reminderVersion: input.expectedReminderVersion }
                    : {}),
            },
            data: {
                ...(dueDateChanged
                    ? { dueDate: calendarDateToDate(input.dueDate) }
                    : {}),
                reminderVersion: { increment: 1 },
            },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError(
                "ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }

        if (assigneesChanged) {
            await tx.routineOccurrenceAssignee.deleteMany({
                where: { occurrenceId },
            });
            await tx.routineOccurrenceAssignee.createMany({
                data: assignees.map((assignee) => ({
                    occurrenceId,
                    employeeId: assignee.employeeId,
                    role: assignee.role,
                })),
            });
        }

        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            {
                taskId: occurrence.taskId,
                occurrenceId,
                operation: "ATOMIC_OCCURRENCE_OVERRIDE",
                note: input.note ?? null,
                before: {
                    dueDate: oldDueDate,
                    originalDueDate: toBangkokCalendarDate(occurrence.originalDueDate),
                    reminderVersion: occurrence.reminderVersion,
                    assignees: occurrence.assignees.map((assignee) => ({
                        employeeId: assignee.employeeId,
                        role: assignee.role,
                    })),
                },
                after: {
                    dueDate: input.dueDate,
                    originalDueDate: toBangkokCalendarDate(occurrence.originalDueDate),
                    reminderVersion: occurrence.reminderVersion + 1,
                    assignees,
                },
            },
        );
        return findOccurrenceForMutation(tx, occurrenceId);
    });
}

export async function updateRoutineOccurrenceDueDate(
    occurrenceId: number,
    input: RoutineDueDateInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    if (!isCalendarDate(input.dueDate)) {
        throw new RoutineValidationError("รูปแบบวันกำหนดไม่ถูกต้อง");
    }
    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const occurrence = await findOccurrenceForMutation(tx, occurrenceId);
        const oldDueDate = toBangkokCalendarDate(occurrence.dueDate);
        if (oldDueDate === input.dueDate) return occurrence;
        const claimed = await tx.routineOccurrence.updateMany({
            where: { id: occurrenceId, dueDate: occurrence.dueDate },
            data: {
                dueDate: calendarDateToDate(input.dueDate),
                reminderVersion: { increment: 1 },
            },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError("วันกำหนดเปลี่ยนแปลงแล้ว");
        }
        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            {
                taskId: occurrence.taskId,
                occurrenceId,
                oldDueDate,
                newDueDate: input.dueDate,
                originalDueDate: toBangkokCalendarDate(occurrence.originalDueDate),
                note: input.note ?? null,
            },
        );
        return findOccurrenceForMutation(tx, occurrenceId);
    });
}

export async function reassignRoutineOccurrence(
    occurrenceId: number,
    input: RoutineOccurrenceAssigneesInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    const assignees = normalizeAssignees(input.assignees);
    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const occurrence = await findOccurrenceForMutation(tx, occurrenceId);
        await assertActiveEmployeesInTransaction(
            tx,
            assignees.map((assignee) => assignee.employeeId),
        );
        await tx.routineOccurrenceAssignee.deleteMany({
            where: { occurrenceId },
        });
        await tx.routineOccurrenceAssignee.createMany({
            data: assignees.map((assignee) => ({
                occurrenceId,
                employeeId: assignee.employeeId,
                role: assignee.role,
            })),
        });
        await tx.routineOccurrence.updateMany({
            where: { id: occurrenceId },
            data: { reminderVersion: { increment: 1 } },
        });
        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_OCCURRENCE_REASSIGN",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            {
                taskId: occurrence.taskId,
                occurrenceId,
                affectedEmployeeIds: assignees.map((assignee) => assignee.employeeId),
                previousEmployeeIds: occurrence.assignees.map(
                    (assignee) => assignee.employeeId,
                ),
            },
        );
        return findOccurrenceForMutation(tx, occurrenceId);
    });
}
