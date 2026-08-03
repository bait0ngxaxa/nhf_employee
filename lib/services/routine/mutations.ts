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
    type RoutineOccurrenceStatusInput,
    type RoutineReasonInput,
    type RoutineReminderRuleInput,
    type RoutineTaskCreateInput,
    type RoutineTaskUpdateInput,
} from "@/lib/validations/routine";

import { createRoutineAuditInTransaction } from "./audit";
import {
    assertActiveAdminInTransaction,
    assertActiveEmployeesInTransaction,
    assertActiveWorkforceInTransaction,
} from "./authorization";
import {
    RoutineConflictError,
    RoutineNotFoundError,
    RoutineValidationError,
} from "./errors";
import { generateRoutineTaskOccurrencesInTransaction } from "./generation";
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

function occurrenceAuditDetails(
    taskId: number,
    occurrenceId: number,
    oldStatus: string,
    newStatus: string,
    extra: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        taskId,
        occurrenceId,
        oldStatus,
        newStatus,
        ...extra,
    };
}

export async function createRoutineTaskInTransaction(
    tx: Prisma.TransactionClient,
    input: RoutineTaskCreateInput,
    actor: RoutineCommandActor,
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
    await generateRoutineTaskOccurrencesInTransaction(tx, task.id);

    return tx.routineTask.findUniqueOrThrow({
        where: { id: task.id },
        include: ROUTINE_TASK_INCLUDE,
    });
}

export async function createRoutineTask(
    input: RoutineTaskCreateInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineTaskGetPayload<{ include: typeof ROUTINE_TASK_INCLUDE }>> {
    return runSerializableTransaction((tx) =>
        createRoutineTaskInTransaction(tx, input, actor),
    );
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
        ensureContractRange(
            input.contractStartDate ?? (current.contractStartDate ? toBangkokCalendarDate(current.contractStartDate) : undefined),
            input.contractEndDate ?? (current.contractEndDate ? toBangkokCalendarDate(current.contractEndDate) : undefined),
        );

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

        if (assigneesChanged || reminderRulesChanged) {
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
            },
        );
        await generateRoutineTaskOccurrencesInTransaction(tx, taskId);

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
    return occurrence;
}

async function assertOccurrenceAccess(
    tx: Prisma.TransactionClient,
    actor: RoutineCommandActor,
    occurrence: Prisma.RoutineOccurrenceGetPayload<{
        include: typeof ROUTINE_OCCURRENCE_INCLUDE;
    }>,
): Promise<void> {
    if (actor.role === "ADMIN") {
        await assertActiveAdminInTransaction(tx, actor);
        return;
    }

    const employeeId = await assertActiveWorkforceInTransaction(tx, actor);
    if (!occurrence.assignees.some((assignee) => assignee.employeeId === employeeId)) {
        throw new RoutineNotFoundError();
    }
}

export async function changeRoutineOccurrenceStatus(
    occurrenceId: number,
    input: RoutineOccurrenceStatusInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    return runSerializableTransaction(async (tx) => {
        const occurrence = await findOccurrenceForMutation(tx, occurrenceId);
        await assertOccurrenceAccess(tx, actor, occurrence);
        const now = new Date();

        if (input.status === "IN_PROGRESS") {
            if (occurrence.status !== "TODO") {
                throw new RoutineConflictError("งานนี้เริ่มดำเนินการแล้ว");
            }
            const claimed = await tx.routineOccurrence.updateMany({
                where: { id: occurrenceId, status: "TODO" },
                data: {
                    status: "IN_PROGRESS",
                    startedAt: occurrence.startedAt ?? now,
                },
            });
            if (claimed.count !== 1) {
                throw new RoutineConflictError("สถานะงานเปลี่ยนแปลงแล้ว");
            }
            await createRoutineAuditInTransaction(
                tx,
                "ROUTINE_OCCURRENCE_START",
                "RoutineOccurrence",
                occurrenceId,
                actor,
                occurrenceAuditDetails(
                    occurrence.taskId,
                    occurrenceId,
                    occurrence.status,
                    "IN_PROGRESS",
                ),
            );
        } else {
            if (occurrence.status !== "TODO" && occurrence.status !== "IN_PROGRESS") {
                throw new RoutineConflictError("งานนี้ปิดงานไปแล้วหรือไม่สามารถปิดได้");
            }
            const claimed = await tx.routineOccurrence.updateMany({
                where: {
                    id: occurrenceId,
                    status: occurrence.status,
                },
                data: {
                    status: "COMPLETED",
                    startedAt: occurrence.startedAt ?? now,
                    completedAt: now,
                    completedById: actor.id,
                    completionNote: input.completionNote ?? null,
                    referenceNo: input.referenceNo ?? null,
                },
            });
            if (claimed.count !== 1) {
                throw new RoutineConflictError("สถานะงานเปลี่ยนแปลงแล้ว");
            }
            await createRoutineAuditInTransaction(
                tx,
                "ROUTINE_OCCURRENCE_COMPLETE",
                "RoutineOccurrence",
                occurrenceId,
                actor,
                occurrenceAuditDetails(
                    occurrence.taskId,
                    occurrenceId,
                    occurrence.status,
                    "COMPLETED",
                    {
                        referenceNo: input.referenceNo ?? null,
                    },
                ),
            );
        }

        return findOccurrenceForMutation(tx, occurrenceId);
    });
}

function ensureReason(input: RoutineReasonInput): string {
    const reason = input.reason.trim();
    if (reason.length < 5) {
        throw new RoutineValidationError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
    }
    return reason;
}

async function changeAdminOccurrenceTerminalStatus(
    occurrenceId: number,
    nextStatus: "SKIPPED" | "CANCELLED",
    input: RoutineReasonInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const occurrence = await findOccurrenceForMutation(tx, occurrenceId);
        if (occurrence.status === "COMPLETED" || occurrence.status === "SKIPPED" || occurrence.status === "CANCELLED") {
            throw new RoutineConflictError("งานนี้อยู่ในสถานะสิ้นสุดแล้ว");
        }
        const reason = ensureReason(input);
        const now = new Date();
        const data: Prisma.RoutineOccurrenceUncheckedUpdateInput = nextStatus === "SKIPPED"
            ? { status: "SKIPPED", skippedAt: now, skippedById: actor.id, skipReason: reason }
            : { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id, cancellationReason: reason };
        const claimed = await tx.routineOccurrence.updateMany({
            where: { id: occurrenceId, status: occurrence.status },
            data,
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError("สถานะงานเปลี่ยนแปลงแล้ว");
        }
        await createRoutineAuditInTransaction(
            tx,
            nextStatus === "SKIPPED"
                ? "ROUTINE_OCCURRENCE_SKIP"
                : "ROUTINE_OCCURRENCE_CANCEL",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            occurrenceAuditDetails(
                occurrence.taskId,
                occurrenceId,
                occurrence.status,
                nextStatus,
                { reason },
            ),
        );
        return findOccurrenceForMutation(tx, occurrenceId);
    });
}

export function skipRoutineOccurrence(
    occurrenceId: number,
    input: RoutineReasonInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    return changeAdminOccurrenceTerminalStatus(
        occurrenceId,
        "SKIPPED",
        input,
        actor,
    );
}

export function cancelRoutineOccurrence(
    occurrenceId: number,
    input: RoutineReasonInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    return changeAdminOccurrenceTerminalStatus(
        occurrenceId,
        "CANCELLED",
        input,
        actor,
    );
}

export async function reopenRoutineOccurrence(
    occurrenceId: number,
    input: RoutineReasonInput,
    actor: RoutineCommandActor,
): Promise<Prisma.RoutineOccurrenceGetPayload<{
    include: typeof ROUTINE_OCCURRENCE_INCLUDE;
}>> {
    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const occurrence = await findOccurrenceForMutation(tx, occurrenceId);
        if (occurrence.status === "TODO" || occurrence.status === "IN_PROGRESS") {
            throw new RoutineConflictError("งานนี้ยังไม่อยู่ในสถานะที่กู้คืนได้");
        }
        const reason = ensureReason(input);
        const claimed = await tx.routineOccurrence.updateMany({
            where: { id: occurrenceId, status: occurrence.status },
            data: {
                status: "TODO",
                reminderVersion: { increment: 1 },
                startedAt: null,
                completedAt: null,
                completedById: null,
                completionNote: null,
                referenceNo: null,
                skippedAt: null,
                skippedById: null,
                skipReason: null,
                cancelledAt: null,
                cancelledById: null,
                cancellationReason: null,
            },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError("สถานะงานเปลี่ยนแปลงแล้ว");
        }
        await createRoutineAuditInTransaction(
            tx,
            "ROUTINE_OCCURRENCE_REOPEN",
            "RoutineOccurrence",
            occurrenceId,
            actor,
            occurrenceAuditDetails(
                occurrence.taskId,
                occurrenceId,
                occurrence.status,
                "TODO",
                { reason },
            ),
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
        const reason = ensureReason(input);
        const oldDueDate = toBangkokCalendarDate(occurrence.dueDate);
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
            occurrenceAuditDetails(
                occurrence.taskId,
                occurrenceId,
                occurrence.status,
                occurrence.status,
                {
                    oldDueDate,
                    newDueDate: input.dueDate,
                    originalDueDate: toBangkokCalendarDate(occurrence.originalDueDate),
                    reason,
                },
            ),
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
