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
    assertActiveRoutineActorInTransaction,
    type RoutineActorAuthorization,
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

function canonicalizeReminderRules(
    rules: RoutineTaskCreateInput["reminderRules"] | RoutineTaskUpdateInput["reminderRules"],
    authorization: RoutineActorAuthorization,
): typeof rules {
    if (authorization.isAdmin || rules === undefined) return rules;
    const canonicalRules = rules.map((rule) => ({
        ...rule,
        recipientScope: "ASSIGNEES" as const,
    }));
    const keys = new Set<string>();
    for (const rule of canonicalRules) {
        const key = `${rule.daysBefore}:${rule.channel}:${rule.recipientScope}`;
        if (keys.has(key)) {
            throw new RoutineValidationError("กฎการแจ้งเตือนซ้ำกันไม่ได้");
        }
        keys.add(key);
    }
    return canonicalRules;
}

function normalizeRoutineTaskCreateInput(
    input: RoutineTaskCreateInput,
    authorization: RoutineActorAuthorization,
): RoutineTaskCreateInput {
    if (authorization.isAdmin) return input;
    if (authorization.employeeId === null) {
        throw new RoutineValidationError("ไม่พบข้อมูลพนักงานของบัญชีผู้ใช้");
    }

    return {
        ...input,
        assignees: [{ employeeId: authorization.employeeId, role: "OWNER" }],
        sourceFileName: undefined,
        sourceSheet: undefined,
        sourceRow: undefined,
        reminderRules: canonicalizeReminderRules(input.reminderRules, authorization),
    };
}

function normalizeRoutineTaskUpdateInput(
    input: RoutineTaskUpdateInput,
    authorization: RoutineActorAuthorization,
): RoutineTaskUpdateInput {
    if (authorization.isAdmin) return input;

    return {
        ...input,
        assignees: undefined,
        sourceFileName: undefined,
        sourceSheet: undefined,
        sourceRow: undefined,
        reminderRules: canonicalizeReminderRules(input.reminderRules, authorization),
    };
}

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
    description: string | null;
    scheduleType: string;
    scheduleText: string | null;
    contractText: string | null;
    extraDetails: string | null;
    businessDayPolicy: string;
    isActive: boolean;
    version: number;
    contractStartDate: Date | null;
    contractEndDate: Date | null;
    unit: { name: string };
    category: { name: string };
}): Record<string, unknown> {
    return {
        taskId: task.id,
        unitId: task.unitId,
        categoryId: task.categoryId,
        title: task.title,
        description: task.description,
        unitName: task.unit.name,
        categoryName: task.category.name,
        scheduleType: task.scheduleType,
        scheduleText: task.scheduleText,
        businessDayPolicy: task.businessDayPolicy,
        isActive: task.isActive,
        version: task.version,
        contractStartDate: task.contractStartDate
            ? toBangkokCalendarDate(task.contractStartDate)
            : null,
        contractEndDate: task.contractEndDate
            ? toBangkokCalendarDate(task.contractEndDate)
            : null,
        contractText: task.contractText,
        extraDetails: task.extraDetails,
    };
}

export async function createRoutineTaskInTransaction(
    tx: Prisma.TransactionClient,
    input: RoutineTaskCreateInput,
    actor: RoutineCommandActor,
    generationOptions: RoutineGenerationOptions = {},
): Promise<Prisma.RoutineTaskGetPayload<{ include: typeof ROUTINE_TASK_INCLUDE }>> {
    const authorization = await assertActiveRoutineActorInTransaction(tx, actor);
    const normalizedInput = normalizeRoutineTaskCreateInput(input, authorization);
    const scheduleType = normalizedInput.scheduleType as RoutineScheduleType;
    const scheduleConfig = parseScheduleConfig(scheduleType, normalizedInput.scheduleConfig);
    ensureContractRange(normalizedInput.contractStartDate, normalizedInput.contractEndDate);
    const assignees = normalizeAssignees(normalizedInput.assignees);

    await assertActiveRoutineReferences(tx, normalizedInput.unitId, normalizedInput.categoryId);
    await assertActiveEmployeesInTransaction(
        tx,
        assignees.map((assignee) => assignee.employeeId),
    );

    const task = await tx.routineTask.create({
        data: {
            unitId: normalizedInput.unitId,
            categoryId: normalizedInput.categoryId,
            title: normalizedInput.title,
            description: normalizedInput.description ?? null,
            scheduleType: scheduleType as PrismaRoutineScheduleType,
            scheduleConfig,
            scheduleText: normalizedInput.scheduleText ?? null,
            contractStartDate: normalizedInput.contractStartDate
                ? calendarDateToDate(normalizedInput.contractStartDate)
                : null,
            contractEndDate: normalizedInput.contractEndDate
                ? calendarDateToDate(normalizedInput.contractEndDate)
                : null,
            contractText: normalizedInput.contractText ?? null,
            extraDetails: normalizedInput.extraDetails ?? null,
            businessDayPolicy: normalizedInput.businessDayPolicy as PrismaRoutineBusinessDayPolicy,
            isActive: normalizedInput.isActive,
            sourceFileName: normalizedInput.sourceFileName ?? null,
            sourceSheet: normalizedInput.sourceSheet ?? null,
            sourceRow: normalizedInput.sourceRow ?? null,
            createdById: actor.id,
            updatedById: actor.id,
            assignees: { create: assignees },
            ...(normalizedInput.reminderRules !== undefined
                ? {
                      reminderRules: {
                          create: normalizeReminderRules(normalizedInput.reminderRules),
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
            title: task.title,
            affectedEmployeeIds: assignees.map((assignee) => assignee.employeeId),
            scheduleType,
            version: task.version,
            ownershipMode: authorization.isAdmin ? "ADMIN" : "SELF_SERVICE",
            createdById: actor.id,
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
    let requestHash: string | null = null;

    class RoutineIdempotencyRaceError extends Error {}

    try {
        return await runSerializableTransaction(async (tx) => {
            const authorization = await assertActiveRoutineActorInTransaction(tx, actor);
            const normalizedInput = normalizeRoutineTaskCreateInput(input, authorization);
            const normalizedRequestHash = createRoutineTaskRequestHash(normalizedInput);
            requestHash = normalizedRequestHash;
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
                    normalizedRequestHash,
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

            const task = await createRoutineTaskInTransaction(tx, normalizedInput, actor);
            try {
                await tx.routineTaskCreateIdempotency.create({
                    data: {
                        userId: actor.id,
                        idempotencyKey: options.idempotencyKey,
                        requestHash: normalizedRequestHash,
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
        if (!existing || requestHash === null) throw error;
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
        const authorization = await assertActiveRoutineActorInTransaction(tx, actor);
        const task = authorization.isAdmin
            ? await tx.routineTask.findUnique({
                  where: { id: taskId },
                  select: {
                      id: true,
                      title: true,
                      version: true,
                      createdById: true,
                  },
              })
            : await tx.routineTask.findFirst({
                  where: { id: taskId, createdById: actor.id },
                  select: {
                      id: true,
                      title: true,
                      version: true,
                      createdById: true,
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
                    type: {
                        in: [
                            "ROUTINE_REMINDER_IN_APP",
                            "ROUTINE_REMINDER_EMAIL",
                            "ROUTINE_REMINDER_LINE",
                        ],
                    },
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
            {
                taskId,
                title: task.title,
                version: task.version,
                ownershipMode: authorization.isAdmin ? "ADMIN" : "SELF_SERVICE",
                createdById: task.createdById,
            },
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
        const authorization = await assertActiveRoutineActorInTransaction(tx, actor);
        const normalizedInput = normalizeRoutineTaskUpdateInput(input, authorization);
        const current = authorization.isAdmin
            ? await tx.routineTask.findUnique({
                  where: { id: taskId },
                  include: ROUTINE_TASK_INCLUDE,
              })
            : await tx.routineTask.findFirst({
                  where: { id: taskId, createdById: actor.id },
                  include: ROUTINE_TASK_INCLUDE,
              });
        if (!current) throw new RoutineNotFoundError();

        const nextScheduleType = (normalizedInput.scheduleType
            ?? current.scheduleType) as RoutineScheduleType;
        const nextScheduleConfig = parseScheduleConfig(
            nextScheduleType,
            normalizedInput.scheduleConfig !== undefined
                ? normalizedInput.scheduleConfig
                : current.scheduleConfig,
        );
        const nextContractStartDate = normalizedInput.contractStartDate === undefined
            ? (current.contractStartDate
                ? toBangkokCalendarDate(current.contractStartDate)
                : undefined)
            : normalizedInput.contractStartDate;
        const nextContractEndDate = normalizedInput.contractEndDate === undefined
            ? (current.contractEndDate
                ? toBangkokCalendarDate(current.contractEndDate)
                : undefined)
            : normalizedInput.contractEndDate;
        ensureContractRange(nextContractStartDate, nextContractEndDate);

        const nextUnitId = normalizedInput.unitId ?? current.unitId;
        const nextCategoryId = normalizedInput.categoryId ?? current.categoryId;
        await assertActiveRoutineReferences(tx, nextUnitId, nextCategoryId);

        const nextAssignees = normalizedInput.assignees
            ? normalizeAssignees(normalizedInput.assignees)
            : null;
        const nextReminderRules = normalizedInput.reminderRules !== undefined
            ? normalizeReminderRules(normalizedInput.reminderRules)
            : null;
        const assigneesChanged = nextAssignees !== null
            && !areAssigneesEqual(current.assignees, nextAssignees);
        const reminderRulesChanged =
            nextReminderRules !== null
            && !areReminderRulesEqual(current.reminderRules, nextReminderRules);
        const isActiveChanged =
            normalizedInput.isActive !== undefined
            && normalizedInput.isActive !== current.isActive;
        if (nextAssignees) {
            await assertActiveEmployeesInTransaction(
                tx,
                nextAssignees.map((assignee) => assignee.employeeId),
            );
        }

        const data: Prisma.RoutineTaskUncheckedUpdateInput = {
            unitId: normalizedInput.unitId,
            categoryId: normalizedInput.categoryId,
            title: normalizedInput.title,
            description: normalizedInput.description,
            scheduleType: nextScheduleType as PrismaRoutineScheduleType,
            scheduleConfig: nextScheduleConfig,
            scheduleText: normalizedInput.scheduleText,
            contractStartDate: normalizedInput.contractStartDate === undefined
                ? undefined
                : normalizedInput.contractStartDate
                    ? calendarDateToDate(normalizedInput.contractStartDate)
                    : null,
            contractEndDate: normalizedInput.contractEndDate === undefined
                ? undefined
                : normalizedInput.contractEndDate
                    ? calendarDateToDate(normalizedInput.contractEndDate)
                    : null,
            contractText: normalizedInput.contractText,
            extraDetails: normalizedInput.extraDetails,
            businessDayPolicy: normalizedInput.businessDayPolicy as PrismaRoutineBusinessDayPolicy | undefined,
            isActive: normalizedInput.isActive,
            sourceFileName: normalizedInput.sourceFileName,
            sourceSheet: normalizedInput.sourceSheet,
            sourceRow: normalizedInput.sourceRow,
            updatedById: actor.id,
            version: { increment: 1 },
        };

        const updated = await tx.routineTask.updateMany({
            where: {
                id: taskId,
                version: normalizedInput.version,
                ...(authorization.isAdmin ? {} : { createdById: actor.id }),
            },
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
            include: ROUTINE_TASK_INCLUDE,
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
                ownershipMode: authorization.isAdmin ? "ADMIN" : "SELF_SERVICE",
                createdById: current.createdById,
                assigneesChanged,
                reminderRulesChanged,
                isActiveChanged,
            },
        );
        await generateRoutineTaskOccurrencesInTransaction(tx, taskId, undefined, {
            previousAssignees: assigneesChanged ? current.assignees : undefined,
        });

        return updatedTask;
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
        if (input.expectedReminderVersion !== occurrence.reminderVersion) {
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

        const claimed = await tx.routineOccurrence.updateMany({
            where: {
                id: occurrenceId,
                reminderVersion: input.expectedReminderVersion,
            },
            data: {
                ...(dueDateChanged
                    ? {
                          dueDate: calendarDateToDate(input.dueDate),
                          isDueDateOverridden: true,
                      }
                    : {}),
                reminderVersion: {
                    increment: dueDateChanged || assigneesChanged ? 1 : 0,
                },
            },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError(
                "ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }
        if (!dueDateChanged && !assigneesChanged) return occurrence;

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
                taskTitle: occurrence.task.title,
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
        if (input.expectedReminderVersion !== occurrence.reminderVersion) {
            throw new RoutineConflictError(
                "ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }
        const dueDateChanged = oldDueDate !== input.dueDate;
        const claimed = await tx.routineOccurrence.updateMany({
            where: {
                id: occurrenceId,
                dueDate: occurrence.dueDate,
                reminderVersion: input.expectedReminderVersion,
            },
            data: {
                ...(dueDateChanged
                    ? {
                          dueDate: calendarDateToDate(input.dueDate),
                          isDueDateOverridden: true,
                      }
                    : {}),
                reminderVersion: { increment: dueDateChanged ? 1 : 0 },
            },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError("วันกำหนดเปลี่ยนแปลงแล้ว");
        }
        if (!dueDateChanged) return occurrence;
        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            {
                taskId: occurrence.taskId,
                taskTitle: occurrence.task.title,
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
        if (input.expectedReminderVersion !== occurrence.reminderVersion) {
            throw new RoutineConflictError(
                "ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }
        const assigneesChanged = !areAssigneesEqual(occurrence.assignees, assignees);
        const claimed = await tx.routineOccurrence.updateMany({
            where: {
                id: occurrenceId,
                reminderVersion: input.expectedReminderVersion,
            },
            data: {
                reminderVersion: { increment: assigneesChanged ? 1 : 0 },
            },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError(
                "ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
            );
        }
        if (!assigneesChanged) return occurrence;
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
        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_OCCURRENCE_REASSIGN",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            {
                taskId: occurrence.taskId,
                taskTitle: occurrence.task.title,
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
