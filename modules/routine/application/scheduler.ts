import { prisma } from "@/lib/db/prisma";
import { hasPrismaErrorCode } from "@/lib/db/transaction";
import { findActiveUsersWithConfiguredCapabilityScope } from "@/modules/authorization";
import {
    calendarDateToDate,
    getCurrentBangkokDate,
    getRoutineReminderScheduledFor,
    isRoutineReminderDue,
    toBangkokCalendarDate,
} from "../domain/schedule";

import { generateRoutineTaskOccurrences } from "./generation";
import { enqueueDueRoutineContractExpiryReminders } from "./contract-reminders";
import {
    buildRoutineReminderEventKey,
    ROUTINE_REMINDER_OUTBOX_TYPE,
} from "./reminders";
import {
    includesRoutineAllReaders,
    includesRoutineAssignees,
    type RoutineReminderRecipientScope,
} from "../domain/reminder-recipients";

const OUTBOX_EVENT_KEY_QUERY_CHUNK_SIZE = 500;

export interface RoutineSchedulerResult {
    occurrencesCreated: number;
    remindersConsidered: number;
    outboxEnqueued: number;
    duplicatesSkipped: number;
    inactiveSkipped: number;
    noRecipientSkipped: number;
    contractRemindersConsidered: number;
    contractOutboxEnqueued: number;
    contractDuplicatesSkipped: number;
    contractNoRecipientSkipped: number;
    errors: number;
}

type RoutineSchedulerOccurrence = {
    id: number;
    taskId: number;
    dueDate: Date;
    reminderVersion: number;
    task: {
        id: number;
        isActive: boolean;
        reminderRules: Array<{
            id: number;
            daysBefore: number;
            sendHour: number;
            channel: "IN_APP";
            recipientScope: RoutineReminderRecipientScope;
            isActive: boolean;
        }>;
    };
    assignees: Array<{
        employee: {
            status: string;
            deletedAt: Date | null;
            user: {
                id: number;
                isActive: boolean;
                deletedAt: Date | null;
            } | null;
        };
    }>;
};

function isUniqueEventKeyConflict(error: unknown): boolean {
    if (!hasPrismaErrorCode(error, "P2002")) return false;
    if (
        typeof error !== "object"
        || error === null
        || !("meta" in error)
        || typeof error.meta !== "object"
        || error.meta === null
        || !("target" in error.meta)
        || !Array.isArray(error.meta.target)
    ) {
        return true;
    }
    return error.meta.target.includes("eventKey");
}

function resolveAssigneeUserIds(
    occurrence: RoutineSchedulerOccurrence,
): number[] {
    return occurrence.assignees.flatMap(({ employee }) => {
        if (
            employee.status !== "ACTIVE"
            || employee.deletedAt !== null
            || !employee.user
            || !employee.user.isActive
            || employee.user.deletedAt !== null
        ) {
            return [];
        }
        return [employee.user.id];
    });
}

function resolveRecipientUserIds(
    occurrence: RoutineSchedulerOccurrence,
    scope: RoutineReminderRecipientScope,
    allReaderUserIds: readonly number[],
): number[] {
    const userIds = new Set<number>();
    if (includesRoutineAssignees(scope)) {
        resolveAssigneeUserIds(occurrence).forEach((userId) => userIds.add(userId));
    }
    if (includesRoutineAllReaders(scope)) {
        allReaderUserIds.forEach((userId) => userIds.add(userId));
    }
    return [...userIds];
}

function buildRoutineReminderPayload(
    occurrence: RoutineSchedulerOccurrence,
    ruleId: number,
    daysBefore: number,
    sendHour: number,
    dueDate: string,
    now: Date,
): string {
    return JSON.stringify({
        occurrenceId: occurrence.id,
        taskId: occurrence.taskId,
        ruleId,
        reminderVersion: occurrence.reminderVersion,
        dueDate,
        scheduledFor: getRoutineReminderScheduledFor(
            dueDate,
            daysBefore,
            sendHour,
        ).toISOString(),
        createdAt: now.toISOString(),
    });
}

type RoutineReminderCandidate = {
    eventKey: string;
    occurrence: RoutineSchedulerOccurrence;
    rule: RoutineSchedulerOccurrence["task"]["reminderRules"][number];
    dueDate: string;
};

async function enqueueRoutineReminder(
    candidate: RoutineReminderCandidate,
    now: Date,
): Promise<"ENQUEUED" | "DUPLICATE"> {
    const { eventKey, occurrence, rule, dueDate } = candidate;
    try {
        await prisma.notificationOutbox.create({
            data: {
                type: ROUTINE_REMINDER_OUTBOX_TYPE,
                eventKey,
                payload: buildRoutineReminderPayload(
                    occurrence,
                    rule.id,
                    rule.daysBefore,
                    rule.sendHour,
                    dueDate,
                    now,
                ),
            },
        });
        return "ENQUEUED";
    } catch (error) {
        if (isUniqueEventKeyConflict(error)) return "DUPLICATE";
        throw error;
    }
}

async function generateRoutineOccurrencesForScheduler(
    now: Date,
    result: RoutineSchedulerResult,
): Promise<void> {
    const tasks = await prisma.routineTask.findMany({
        where: { isActive: true, scheduleType: { not: "MANUAL" } },
        select: { id: true },
    });

    for (const task of tasks) {
        try {
            const generation = await generateRoutineTaskOccurrences(task.id, now);
            result.occurrencesCreated += generation.created;
        } catch (error) {
            result.errors += 1;
            console.error("Routine scheduler occurrence generation failed", {
                taskId: task.id,
                errorType: error instanceof Error ? error.name : "UnknownError",
            });
        }
    }
}

async function findSchedulerOccurrences(
    now: Date,
): Promise<RoutineSchedulerOccurrence[]> {
    const currentDate = getCurrentBangkokDate(now);
    const rows = await prisma.routineOccurrence.findMany({
        where: {
            dueDate: { gte: calendarDateToDate(currentDate) },
        },
        select: {
            id: true,
            taskId: true,
            dueDate: true,
            reminderVersion: true,
            task: {
                select: {
                    id: true,
                    isActive: true,
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
                },
            },
            assignees: {
                select: {
                    employee: {
                        select: {
                            status: true,
                            deletedAt: true,
                            user: {
                                select: {
                                    id: true,
                                    isActive: true,
                                    deletedAt: true,
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
    return rows;
}

export async function runRoutineScheduler(
    now = new Date(),
): Promise<RoutineSchedulerResult> {
    const result: RoutineSchedulerResult = {
        occurrencesCreated: 0,
        remindersConsidered: 0,
        outboxEnqueued: 0,
        duplicatesSkipped: 0,
        inactiveSkipped: 0,
        noRecipientSkipped: 0,
        contractRemindersConsidered: 0,
        contractOutboxEnqueued: 0,
        contractDuplicatesSkipped: 0,
        contractNoRecipientSkipped: 0,
        errors: 0,
    };

    await generateRoutineOccurrencesForScheduler(now, result);

    const occurrences = await findSchedulerOccurrences(now);
    const hasAllReaderRule = occurrences.some((occurrence) =>
        occurrence.task.reminderRules.some((rule) =>
            rule.isActive
            && rule.channel === "IN_APP"
            && includesRoutineAllReaders(rule.recipientScope),
        ),
    );
    const allReaderUserIds = hasAllReaderRule
        ? await findActiveUsersWithConfiguredCapabilityScope({
            capability: "routine.task.read",
            scope: "ALL",
        })
        : [];
    const reminderCandidates: RoutineReminderCandidate[] = [];
    for (const occurrence of occurrences) {
        if (!occurrence.task.isActive) {
            result.inactiveSkipped += 1;
            continue;
        }

        const dueDate = toBangkokCalendarDate(occurrence.dueDate);
        for (const rule of occurrence.task.reminderRules) {
            if (!rule.isActive || rule.channel !== "IN_APP") {
                result.inactiveSkipped += 1;
                continue;
            }
            result.remindersConsidered += 1;
            if (!isRoutineReminderDue(dueDate, rule.daysBefore, rule.sendHour, now)) {
                continue;
            }

            const recipientUserIds = resolveRecipientUserIds(
                occurrence,
                rule.recipientScope,
                allReaderUserIds,
            );
            if (recipientUserIds.length === 0) {
                result.noRecipientSkipped += 1;
                continue;
            }

            reminderCandidates.push({
                eventKey: buildRoutineReminderEventKey(
                    occurrence.id,
                    rule.id,
                    occurrence.reminderVersion,
                ),
                occurrence,
                rule,
                dueDate,
            });
        }
    }

    for (
        let offset = 0;
        offset < reminderCandidates.length;
        offset += OUTBOX_EVENT_KEY_QUERY_CHUNK_SIZE
    ) {
        const candidates = reminderCandidates.slice(
            offset,
            offset + OUTBOX_EVENT_KEY_QUERY_CHUNK_SIZE,
        );
        let existingEventKeys: Set<string>;
        try {
            const existingRows = await prisma.notificationOutbox.findMany({
                where: {
                    eventKey: { in: candidates.map(({ eventKey }) => eventKey) },
                },
                select: { eventKey: true },
            });
            existingEventKeys = new Set(
                existingRows.flatMap(({ eventKey }) =>
                    eventKey === null ? [] : [eventKey],
                ),
            );
        } catch (error) {
            for (const candidate of candidates) {
                result.errors += 1;
                console.error("Routine scheduler reminder enqueue failed", {
                    occurrenceId: candidate.occurrence.id,
                    ruleId: candidate.rule.id,
                    errorType: error instanceof Error ? error.name : "UnknownError",
                });
            }
            continue;
        }

        for (const candidate of candidates) {
            if (existingEventKeys.has(candidate.eventKey)) {
                result.duplicatesSkipped += 1;
                continue;
            }
            try {
                const outcome = await enqueueRoutineReminder(candidate, now);
                if (outcome === "ENQUEUED") {
                    result.outboxEnqueued += 1;
                } else {
                    result.duplicatesSkipped += 1;
                }
            } catch (error) {
                result.errors += 1;
                console.error("Routine scheduler reminder enqueue failed", {
                    occurrenceId: candidate.occurrence.id,
                    ruleId: candidate.rule.id,
                    errorType: error instanceof Error ? error.name : "UnknownError",
                });
            }
        }
    }

    try {
        const contractResult = await enqueueDueRoutineContractExpiryReminders(now);
        result.contractRemindersConsidered = contractResult.considered;
        result.contractOutboxEnqueued = contractResult.enqueued;
        result.contractDuplicatesSkipped = contractResult.duplicatesSkipped;
        result.contractNoRecipientSkipped = contractResult.noRecipientSkipped;
        result.errors += contractResult.errors;
    } catch (error) {
        result.errors += 1;
        console.error("Routine scheduler contract expiry evaluation failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
    }

    return result;
}
