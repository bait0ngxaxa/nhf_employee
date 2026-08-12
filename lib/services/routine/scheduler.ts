import { prisma } from "@/lib/db/prisma";
import { hasPrismaErrorCode } from "@/lib/db/transaction";
import {
    calendarDateToDate,
    getCurrentBangkokDate,
    getRoutineReminderScheduledFor,
    isRoutineReminderDue,
    toBangkokCalendarDate,
} from "@/lib/routine/schedule";

import { generateRoutineTaskOccurrences } from "./generation";
import { enqueueDueRoutineContractExpiryReminders } from "./contract-reminders";
import {
    buildRoutineReminderEventKey,
    ROUTINE_REMINDER_OUTBOX_TYPE,
} from "./reminders";

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

type RoutineReminderRecipientScope =
    | "ASSIGNEES"
    | "ADMINS"
    | "ASSIGNEES_AND_ADMINS";

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
    adminUserIds: readonly number[],
): number[] {
    const userIds = new Set<number>();
    if (scope === "ASSIGNEES" || scope === "ASSIGNEES_AND_ADMINS") {
        resolveAssigneeUserIds(occurrence).forEach((userId) => userIds.add(userId));
    }
    if (scope === "ADMINS" || scope === "ASSIGNEES_AND_ADMINS") {
        adminUserIds.forEach((userId) => userIds.add(userId));
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

async function enqueueRoutineReminder(
    occurrence: RoutineSchedulerOccurrence,
    rule: RoutineSchedulerOccurrence["task"]["reminderRules"][number],
    dueDate: string,
    now: Date,
): Promise<"ENQUEUED" | "DUPLICATE"> {
    const eventKey = buildRoutineReminderEventKey(
        occurrence.id,
        rule.id,
        occurrence.reminderVersion,
    );
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
    return rows as RoutineSchedulerOccurrence[];
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

    const [occurrences, admins] = await Promise.all([
        findSchedulerOccurrences(now),
        prisma.user.findMany({
            where: { role: "ADMIN", isActive: true, deletedAt: null },
            select: { id: true },
        }),
    ]);
    const adminUserIds = admins.map((admin) => admin.id);
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
                adminUserIds,
            );
            if (recipientUserIds.length === 0) {
                result.noRecipientSkipped += 1;
                continue;
            }

            try {
                const outcome = await enqueueRoutineReminder(
                    occurrence,
                    rule,
                    dueDate,
                    now,
                );
                if (outcome === "ENQUEUED") {
                    result.outboxEnqueued += 1;
                } else {
                    result.duplicatesSkipped += 1;
                }
            } catch (error) {
                result.errors += 1;
                console.error("Routine scheduler reminder enqueue failed", {
                    occurrenceId: occurrence.id,
                    ruleId: rule.id,
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
