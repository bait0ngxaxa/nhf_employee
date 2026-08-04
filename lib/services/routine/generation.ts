import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { buildRoutineScheduleDefinition } from "@/lib/validations/routine";
import {
    calculateRoutineOccurrences,
    calendarDateToDate,
    compareCalendarDates,
    getRoutineGenerationWindow,
    toBangkokCalendarDate,
    type RoutineScheduleType,
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

async function deleteStaleFutureOccurrences(
    tx: Prisma.TransactionClient,
    taskId: number,
    currentDate: string,
    windowTo: string,
    candidatePeriodKeys: readonly string[],
): Promise<void> {
    await tx.routineOccurrence.deleteMany({
        where: {
            taskId,
            dueDate: {
                gte: calendarDateToDate(currentDate),
                lte: calendarDateToDate(windowTo),
            },
            ...(candidatePeriodKeys.length > 0
                ? { periodKey: { notIn: [...candidatePeriodKeys] } }
                : {}),
        },
    });
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
    const window = getRoutineGenerationWindow(now, maxActiveDaysBefore);
    const currentDate = toBangkokCalendarDate(now);

    if (task.scheduleType === "MANUAL") {
        await deleteStaleFutureOccurrences(
            tx,
            task.id,
            currentDate,
            window.to,
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

    const generationCandidates = scheduledOccurrences.filter((occurrence) => {
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
    });

    const existingFutureOccurrences = await tx.routineOccurrence.findMany({
        where: {
            taskId: task.id,
            dueDate: {
                gte: calendarDateToDate(currentDate),
                lte: calendarDateToDate(window.to),
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
    await deleteStaleFutureOccurrences(
        tx,
        task.id,
        currentDate,
        window.to,
        generationCandidates.map((occurrence) => occurrence.periodKey),
    );

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
            const currentOriginalDueDate = toBangkokCalendarDate(
                current.originalDueDate,
            );
            const currentDueDate = toBangkokCalendarDate(current.dueDate);
            const originalDateChanged =
                currentOriginalDueDate !== occurrence.originalDueDate;
            const hasManualDueDate = currentDueDate !== currentOriginalDueDate;
            const dueDateChanged =
                !hasManualDueDate && currentDueDate !== occurrence.dueDate;
            const shouldSyncAssignees = shouldSyncFutureAssignees(
                current,
                currentDate,
                options.previousAssignees,
            );
            const shouldRefreshSchedule =
                current.scheduleVersion !== task.version
                || originalDateChanged
                || dueDateChanged;

            if (shouldRefreshSchedule) {
                await tx.routineOccurrence.updateMany({
                    where: {
                        id: current.id,
                        scheduleVersion: current.scheduleVersion,
                    },
                    data: {
                        scheduleVersion: task.version,
                        ...(originalDateChanged
                            ? {
                                  originalDueDate: calendarDateToDate(
                                      occurrence.originalDueDate,
                                  ),
                              }
                            : {}),
                        ...(dueDateChanged
                            ? {
                                  dueDate: calendarDateToDate(occurrence.dueDate),
                              }
                            : {}),
                        ...(originalDateChanged || dueDateChanged
                            ? { reminderVersion: { increment: 1 } }
                            : {}),
                    },
                });
            }
            if (shouldSyncAssignees) {
                await tx.routineOccurrenceAssignee.deleteMany({
                    where: { occurrenceId: current.id },
                });
                await tx.routineOccurrenceAssignee.createMany({
                    data: task.assignees.map((assignee) => ({
                        occurrenceId: current.id,
                        employeeId: assignee.employeeId,
                        role: assignee.role,
                    })),
                });
            }
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
