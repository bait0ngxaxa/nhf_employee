import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { buildRoutineScheduleDefinition } from "@/lib/validations/routine";
import {
    addCalendarDays,
    calculateRoutineOccurrences,
    calendarDateToDate,
    compareCalendarDates,
    endOfMonth,
    getRoutineGenerationWindow,
    ROUTINE_MAX_REMINDER_DAYS_BEFORE,
    ROUTINE_RECONCILIATION_MAX_FUTURE_DAYS,
    ROUTINE_RECONCILIATION_MAX_PAST_DAYS,
    startOfMonth,
    toBangkokCalendarDate,
    type CalendarDate,
    type RoutineScheduleType,
    type ScheduledRoutineOccurrence,
} from "@/lib/routine/schedule";
import { runSerializableTransaction } from "@/lib/db/transaction";

import { RoutineValidationError } from "./errors";
import type {
    RoutineAssigneeSnapshot,
    RoutineGenerationResult,
} from "./types";

export interface RoutineGenerationOptions {
    excludePastDue?: boolean;
    previousAssignees?: readonly RoutineAssigneeSnapshot[];
}

function isOccurrenceUniqueConflict(error: unknown): boolean {
    if (
        typeof error !== "object"
        || error === null
        || !("code" in error)
        || error.code !== "P2002"
        || !("meta" in error)
        || typeof error.meta !== "object"
        || error.meta === null
        || !("target" in error.meta)
        || !Array.isArray(error.meta.target)
    ) {
        return false;
    }

    return (
        error.meta.target.includes("taskId")
        && error.meta.target.includes("periodKey")
    );
}

const ROUTINE_OCCURRENCE_RECONCILIATION_SELECT = {
    id: true,
    periodKey: true,
    dueDate: true,
    originalDueDate: true,
    scheduleVersion: true,
    assignees: {
        select: { employeeId: true, role: true },
    },
} as const satisfies Prisma.RoutineOccurrenceSelect;

type RoutineOccurrenceReconciliationRow = Prisma.RoutineOccurrenceGetPayload<{
    select: typeof ROUTINE_OCCURRENCE_RECONCILIATION_SELECT;
}>;

function assigneeSnapshotKey(
    assignees: readonly RoutineAssigneeSnapshot[],
): string {
    return assignees
        .map((assignee) => `${assignee.employeeId}:${assignee.role}`)
        .sort()
        .join("|");
}

function shouldSyncFutureAssignees(
    occurrence: RoutineOccurrenceReconciliationRow,
    currentDate: string,
    previousAssignees: readonly RoutineAssigneeSnapshot[] | undefined,
): boolean {
    if (!previousAssignees) return false;
    if (
        compareCalendarDates(
            toBangkokCalendarDate(occurrence.dueDate),
            currentDate,
        ) < 0
    ) {
        return false;
    }

    return assigneeSnapshotKey(occurrence.assignees)
        === assigneeSnapshotKey(previousAssignees);
}

async function refreshExistingRoutineOccurrence(
    tx: Prisma.TransactionClient,
    current: RoutineOccurrenceReconciliationRow,
    candidate: ScheduledRoutineOccurrence,
    taskVersion: number,
    currentDate: CalendarDate,
    taskAssignees: ReadonlyArray<
        RoutineOccurrenceReconciliationRow["assignees"][number]
    >,
    previousAssignees: readonly RoutineAssigneeSnapshot[] | undefined,
): Promise<void> {
    const currentOriginalDueDate = toBangkokCalendarDate(
        current.originalDueDate,
    );
    const currentDueDate = toBangkokCalendarDate(current.dueDate);
    const originalDateChanged =
        currentOriginalDueDate !== candidate.originalDueDate;
    const hasManualDueDate = currentDueDate !== currentOriginalDueDate;
    const dueDateChanged =
        !hasManualDueDate && currentDueDate !== candidate.dueDate;
    const shouldSyncAssignees = shouldSyncFutureAssignees(
        current,
        currentDate,
        previousAssignees,
    );
    const shouldRefreshSchedule =
        current.scheduleVersion !== taskVersion
        || originalDateChanged
        || dueDateChanged;

    if (shouldRefreshSchedule) {
        await tx.routineOccurrence.updateMany({
            where: {
                id: current.id,
                scheduleVersion: current.scheduleVersion,
            },
            data: {
                scheduleVersion: taskVersion,
                ...(originalDateChanged
                    ? {
                          originalDueDate: calendarDateToDate(
                              candidate.originalDueDate,
                          ),
                      }
                    : {}),
                ...(dueDateChanged
                    ? { dueDate: calendarDateToDate(candidate.dueDate) }
                    : {}),
                ...(originalDateChanged || dueDateChanged
                    ? { reminderVersion: { increment: 1 } }
                    : {}),
            },
        });
    }
    if (!shouldSyncAssignees) return;

    await tx.routineOccurrenceAssignee.deleteMany({
        where: { occurrenceId: current.id },
    });
    await tx.routineOccurrenceAssignee.createMany({
        data: taskAssignees.map((assignee) => ({
            occurrenceId: current.id,
            employeeId: assignee.employeeId,
            role: assignee.role,
        })),
    });
}

function isWithinRoutineContract(
    occurrence: { dueDate: CalendarDate },
    contractStartDate: CalendarDate | null,
    contractEndDate: CalendarDate | null,
): boolean {
    if (
        contractStartDate
        && compareCalendarDates(occurrence.dueDate, contractStartDate) < 0
    ) {
        return false;
    }
    if (
        contractEndDate
        && compareCalendarDates(occurrence.dueDate, contractEndDate) > 0
    ) {
        return false;
    }
    return true;
}

async function deleteStaleFutureOccurrences(
    tx: Prisma.TransactionClient,
    taskId: number,
    currentDate: string,
    reconciliationWindowTo: string | null,
    validPeriodKeys: readonly string[],
): Promise<void> {
    await tx.routineOccurrence.deleteMany({
        where: {
            taskId,
            dueDate: {
                gte: calendarDateToDate(currentDate),
                ...(reconciliationWindowTo
                    ? { lte: calendarDateToDate(reconciliationWindowTo) }
                    : {}),
            },
            ...(validPeriodKeys.length > 0
                ? { periodKey: { notIn: [...validPeriodKeys] } }
                : {}),
        },
    });
}

function assertSupportedReminderHorizon(
    taskId: number,
    maxActiveDaysBefore: number,
): void {
    if (
        Number.isInteger(maxActiveDaysBefore)
        && maxActiveDaysBefore >= 0
        && maxActiveDaysBefore <= ROUTINE_MAX_REMINDER_DAYS_BEFORE
    ) {
        return;
    }

    console.error("Routine generation found an invalid reminder horizon", {
        taskId,
        maxActiveDaysBefore,
        maximumSupportedDaysBefore: ROUTINE_MAX_REMINDER_DAYS_BEFORE,
    });
    throw new RoutineValidationError(
        "พบระยะเวลาแจ้งเตือนล่วงหน้าที่อยู่นอกช่วงที่ระบบรองรับ กรุณาตรวจสอบข้อมูล",
    );
}

async function assertFutureOccurrencesWithinSafetyBounds(
    tx: Prisma.TransactionClient,
    taskId: number,
    currentDate: string,
): Promise<void> {
    const futureSafetyBound = addCalendarDays(
        currentDate,
        ROUTINE_RECONCILIATION_MAX_FUTURE_DAYS,
    );
    const pastSafetyBound = addCalendarDays(
        currentDate,
        -ROUTINE_RECONCILIATION_MAX_PAST_DAYS,
    );
    const unsafeOccurrence = await tx.routineOccurrence.findFirst({
        where: {
            taskId,
            dueDate: { gte: calendarDateToDate(currentDate) },
            OR: [
                { dueDate: { gt: calendarDateToDate(futureSafetyBound) } },
                {
                    originalDueDate: {
                        gt: calendarDateToDate(futureSafetyBound),
                    },
                },
                {
                    originalDueDate: {
                        lt: calendarDateToDate(pastSafetyBound),
                    },
                },
            ],
        },
        select: { id: true, dueDate: true, originalDueDate: true },
    });
    if (!unsafeOccurrence) return;

    console.error("Routine reconciliation found an occurrence beyond its safety bound", {
        taskId,
        occurrenceId: unsafeOccurrence.id,
        pastSafetyBound,
        futureSafetyBound,
    });
    throw new RoutineValidationError(
        "พบข้อมูลรอบงานประจำอยู่นอกช่วงที่ระบบรองรับ กรุณาตรวจสอบข้อมูล",
    );
}

export async function generateRoutineTaskOccurrences(
    taskId: number,
    now = new Date(),
    options: RoutineGenerationOptions = {},
): Promise<RoutineGenerationResult> {
    return runSerializableTransaction((tx) =>
        generateRoutineTaskOccurrencesInTransaction(tx, taskId, now, options),
    );
}

export async function generateRoutineTaskOccurrencesInTransaction(
    tx: Prisma.TransactionClient,
    taskId: number,
    now = new Date(),
    options: RoutineGenerationOptions = {},
): Promise<RoutineGenerationResult> {
    const task = await tx.routineTask.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            isActive: true,
            scheduleType: true,
            scheduleConfig: true,
            businessDayPolicy: true,
            version: true,
            contractStartDate: true,
            contractEndDate: true,
            assignees: {
                select: { employeeId: true, role: true },
            },
            reminderRules: {
                where: { isActive: true },
                select: { daysBefore: true },
            },
        },
    });

    if (!task || !task.isActive) {
        return { evaluated: 0, created: 0, existing: 0 };
    }

    const maxActiveDaysBefore = (task.reminderRules ?? []).reduce(
        (maximum, rule) => Math.max(maximum, rule.daysBefore),
        0,
    );
    assertSupportedReminderHorizon(task.id, maxActiveDaysBefore);
    const window = getRoutineGenerationWindow(now, maxActiveDaysBefore);
    const currentDate = toBangkokCalendarDate(now);

    if (task.scheduleType === "MANUAL") {
        await deleteStaleFutureOccurrences(
            tx,
            task.id,
            currentDate,
            null,
            [],
        );
        return { evaluated: 0, created: 0, existing: 0 };
    }

    let definition;
    try {
        definition = buildRoutineScheduleDefinition(
            task.scheduleType as RoutineScheduleType,
            task.scheduleConfig,
        );
    } catch (error) {
        if (error instanceof ZodError) {
            throw new RoutineValidationError(
                "กำหนดค่าตารางงานประจำไม่ถูกต้อง",
            );
        }
        throw error;
    }

    const scheduledOccurrences = calculateRoutineOccurrences(
        definition,
        window,
        task.businessDayPolicy,
    );
    const contractStartDate = task.contractStartDate
        ? toBangkokCalendarDate(task.contractStartDate)
        : null;
    const contractEndDate = task.contractEndDate
        ? toBangkokCalendarDate(task.contractEndDate)
        : null;

    const generationCandidates = scheduledOccurrences.filter((occurrence) =>
        isWithinRoutineContract(occurrence, contractStartDate, contractEndDate),
    );

    await assertFutureOccurrencesWithinSafetyBounds(
        tx,
        task.id,
        currentDate,
    );

    const reconciliationSafetyBound = addCalendarDays(
        currentDate,
        ROUTINE_RECONCILIATION_MAX_FUTURE_DAYS,
    );

    const existingFutureOccurrences = await tx.routineOccurrence.findMany({
        where: {
            taskId: task.id,
            dueDate: {
                gte: calendarDateToDate(currentDate),
                lte: calendarDateToDate(reconciliationSafetyBound),
            },
        },
        select: ROUTINE_OCCURRENCE_RECONCILIATION_SELECT,
    });
    const existingByPeriodKey = new Map(
        existingFutureOccurrences.map((occurrence) => [
            occurrence.periodKey,
            occurrence,
        ]),
    );
    const existingFutureMaxDate = existingFutureOccurrences.reduce(
        (maximum, occurrence) => {
            const occurrenceDueDate = toBangkokCalendarDate(occurrence.dueDate);
            const occurrenceOriginalDueDate = toBangkokCalendarDate(
                occurrence.originalDueDate,
            );
            const latestDate = compareCalendarDates(
                occurrenceDueDate,
                occurrenceOriginalDueDate,
            ) >= 0
                ? occurrenceDueDate
                : occurrenceOriginalDueDate;
            return compareCalendarDates(latestDate, maximum) > 0
                ? latestDate
                : maximum;
        },
        window.to,
    );
    const reconciliationWindowFrom = existingFutureOccurrences.reduce(
        (minimum, occurrence) => {
            const occurrenceOriginalDueDate = toBangkokCalendarDate(
                occurrence.originalDueDate,
            );
            return compareCalendarDates(occurrenceOriginalDueDate, minimum) < 0
                ? occurrenceOriginalDueDate
                : minimum;
        },
        window.from,
    );
    const reconciliationValidityCandidates = calculateRoutineOccurrences(
        definition,
        {
            from: startOfMonth(reconciliationWindowFrom),
            to: endOfMonth(existingFutureMaxDate),
        },
        task.businessDayPolicy,
    ).filter((occurrence) =>
        isWithinRoutineContract(occurrence, contractStartDate, contractEndDate),
    );
    const reconciliationCandidatesByPeriodKey = new Map(
        reconciliationValidityCandidates.map((occurrence) => [
            occurrence.periodKey,
            occurrence,
        ]),
    );
    await deleteStaleFutureOccurrences(
        tx,
        task.id,
        currentDate,
        existingFutureMaxDate,
        [...reconciliationCandidatesByPeriodKey.keys()],
    );

    const generationPeriodKeys = new Set(
        generationCandidates.map((occurrence) => occurrence.periodKey),
    );
    for (const current of existingFutureOccurrences) {
        if (generationPeriodKeys.has(current.periodKey)) continue;
        const candidate = reconciliationCandidatesByPeriodKey.get(
            current.periodKey,
        );
        if (!candidate) continue;

        await refreshExistingRoutineOccurrence(
            tx,
            current,
            candidate,
            task.version,
            currentDate,
            task.assignees,
            options.previousAssignees,
        );
    }

    let created = 0;
    let existing = 0;
    for (const occurrence of generationCandidates) {
        const current = existingByPeriodKey.get(occurrence.periodKey)
            ?? await tx.routineOccurrence.findUnique({
                where: {
                    taskId_periodKey: {
                        taskId: task.id,
                        periodKey: occurrence.periodKey,
                    },
                },
                select: ROUTINE_OCCURRENCE_RECONCILIATION_SELECT,
            });
        if (current) {
            await refreshExistingRoutineOccurrence(
                tx,
                current,
                occurrence,
                task.version,
                currentDate,
                task.assignees,
                options.previousAssignees,
            );
            existing += 1;
            continue;
        }

        if (
            options.excludePastDue
            && compareCalendarDates(occurrence.dueDate, currentDate) < 0
        ) {
            continue;
        }

        try {
            await tx.routineOccurrence.upsert({
                where: {
                    taskId_periodKey: {
                        taskId: task.id,
                        periodKey: occurrence.periodKey,
                    },
                },
                update: {},
                create: {
                    taskId: task.id,
                    periodKey: occurrence.periodKey,
                    dueDate: calendarDateToDate(occurrence.dueDate),
                    originalDueDate: calendarDateToDate(occurrence.originalDueDate),
                    scheduleVersion: task.version,
                    assignees: {
                        create: task.assignees.map((assignee) => ({
                            employeeId: assignee.employeeId,
                            role: assignee.role,
                        })),
                    },
                },
            });
            created += 1;
        } catch (error) {
            if (!isOccurrenceUniqueConflict(error)) {
                throw error;
            }
            existing += 1;
        }
    }

    return {
        evaluated: generationCandidates.length,
        created,
        existing,
    };
}
