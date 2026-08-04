import type { NotificationOutbox, Prisma } from "@prisma/client";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    createInAppNotificationOnce,
} from "@/lib/services/notifications/in-app";
import { APP_DASHBOARD_TABS, APP_ROUTES } from "@/lib/ssot/routes";
import {
    getRoutineReminderScheduledFor,
    isRoutineReminderExpired,
    isRoutineReminderDue,
    toBangkokCalendarDate,
} from "@/lib/routine/schedule";
import {
    routineReminderOutboxPayloadSchema,
    type RoutineReminderOutboxPayload,
} from "@/lib/validations/routine";

export const ROUTINE_REMINDER_OUTBOX_TYPE = "ROUTINE_REMINDER_IN_APP" as const;

export type RoutineReminderDispatchResult =
    | "SENT"
    | "SUPERSEDED"
    | "DEFERRED"
    | null;

type OutboxMutationClient = Pick<Prisma.TransactionClient, "notificationOutbox">;

type RoutineReminderRecipientSnapshot = {
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

function isActiveUser(user: {
    isActive: boolean;
    deletedAt: Date | null;
}): boolean {
    return user.isActive && user.deletedAt === null;
}

function isActiveEmployee(employee: {
    status: string;
    deletedAt: Date | null;
}): boolean {
    return employee.status === "ACTIVE" && employee.deletedAt === null;
}

export function buildRoutineReminderEventKey(
    occurrenceId: number,
    ruleId: number,
    reminderVersion: number,
): string {
    return `routine:${occurrenceId}:rule:${ruleId}:version:${reminderVersion}`;
}

export function buildRoutineReminderDedupeKey(
    occurrenceId: number,
    ruleId: number,
    userId: number,
    reminderVersion: number,
): string {
    return `routine:${occurrenceId}:rule:${ruleId}:user:${userId}:version:${reminderVersion}`;
}

export function getRoutineReminderActionUrl(
    occurrenceId: number,
    taskId: number,
): string {
    return `${APP_ROUTES.dashboard}?tab=${APP_DASHBOARD_TABS.routine}&taskId=${taskId}&occurrenceId=${occurrenceId}`;
}

export function formatRoutineReminderMessage(
    title: string,
    dueDate: string,
    daysBefore: number,
): string {
    const formattedDate = new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(`${dueDate}T00:00:00.000+07:00`));
    const timing = daysBefore === 0
        ? "ครบกำหนดวันนี้"
        : `เหลือเวลา ${daysBefore} วัน`;
    return `“${title}” จะครบกำหนดวันที่ ${formattedDate}\n${timing}`;
}

function resolveAssigneeUserIds(
    snapshot: RoutineReminderRecipientSnapshot,
): number[] {
    return snapshot.assignees.flatMap(({ employee }) => {
        if (!isActiveEmployee(employee) || !employee.user || !isActiveUser(employee.user)) {
            return [];
        }
        return [employee.user.id];
    });
}

async function resolveRoutineRecipientUserIds(
    tx: Pick<Prisma.TransactionClient, "user">,
    scope: "ASSIGNEES" | "ADMINS" | "ASSIGNEES_AND_ADMINS",
    snapshot: RoutineReminderRecipientSnapshot,
): Promise<number[]> {
    const userIds = new Set<number>();
    if (scope === "ASSIGNEES" || scope === "ASSIGNEES_AND_ADMINS") {
        resolveAssigneeUserIds(snapshot).forEach((userId) => userIds.add(userId));
    }
    if (scope === "ADMINS" || scope === "ASSIGNEES_AND_ADMINS") {
        const admins = await tx.user.findMany({
            where: { role: Role.ADMIN, isActive: true, deletedAt: null },
            select: { id: true },
        });
        admins.forEach((admin) => userIds.add(admin.id));
    }
    return [...userIds];
}

async function markRoutineReminderSuperseded(
    client: OutboxMutationClient,
    notificationId: number,
    reason: string,
): Promise<void> {
    await client.notificationOutbox.updateMany({
        where: { id: notificationId, status: "PROCESSING" },
        data: { status: "SUPERSEDED", lastError: reason },
    });
}

async function deferRoutineReminder(
    client: OutboxMutationClient,
    notificationId: number,
    nextAttemptAt: Date,
): Promise<void> {
    await client.notificationOutbox.updateMany({
        where: { id: notificationId, status: "PROCESSING" },
        data: {
            status: "PENDING",
            nextAttemptAt,
            lastError: null,
        },
    });
}

function parseRoutineReminderPayload(
    value: unknown,
): RoutineReminderOutboxPayload | null {
    const parsed = routineReminderOutboxPayloadSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

export async function dispatchRoutineReminderOutbox(
    notification: NotificationOutbox,
    value: unknown,
    now = new Date(),
): Promise<RoutineReminderDispatchResult> {
    if (notification.type !== ROUTINE_REMINDER_OUTBOX_TYPE) return null;

    const payload = parseRoutineReminderPayload(value);
    if (!payload) {
        await markRoutineReminderSuperseded(
            prisma,
            notification.id,
            "Superseded invalid Routine reminder payload",
        );
        return "SUPERSEDED";
    }

    return runSerializableTransaction(async (tx) => {
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notification.id, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return "SUPERSEDED";

        const expectedEventKey = buildRoutineReminderEventKey(
            payload.occurrenceId,
            payload.ruleId,
            payload.reminderVersion,
        );
        if (notification.eventKey !== expectedEventKey) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded mismatched Routine reminder event key",
            );
            return "SUPERSEDED";
        }

        const occurrence = await tx.routineOccurrence.findUnique({
            where: { id: payload.occurrenceId },
            select: {
                id: true,
                taskId: true,
                dueDate: true,
                reminderVersion: true,
                task: {
                    select: {
                        id: true,
                        title: true,
                        isActive: true,
                        reminderRules: {
                            where: { id: payload.ruleId },
                            select: {
                                id: true,
                                daysBefore: true,
                                sendHour: true,
                                channel: true,
                                recipientScope: true,
                                isActive: true,
                            },
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
        });
        const rule = occurrence?.task.reminderRules[0];
        const currentDueDate = occurrence
            ? toBangkokCalendarDate(occurrence.dueDate)
            : null;

        if (
            !occurrence
            || occurrence.taskId !== payload.taskId
            || !occurrence.task.isActive
            || !rule
            || !rule.isActive
            || rule.channel !== "IN_APP"
            || occurrence.reminderVersion !== payload.reminderVersion
            || currentDueDate !== payload.dueDate
        ) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded stale Routine reminder",
            );
            return "SUPERSEDED";
        }

        const expectedScheduledFor = getRoutineReminderScheduledFor(
            payload.dueDate,
            rule.daysBefore,
            rule.sendHour,
        );
        const payloadScheduledFor = payload.scheduledFor
            ? new Date(payload.scheduledFor)
            : expectedScheduledFor;
        const hasValidScheduledFor = !Number.isNaN(payloadScheduledFor.getTime());
        if (
            !hasValidScheduledFor
            || payloadScheduledFor.getTime() !== expectedScheduledFor.getTime()
        ) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded mismatched Routine reminder schedule",
            );
            return "SUPERSEDED";
        }

        if (!isRoutineReminderDue(payload.dueDate, rule.daysBefore, rule.sendHour, now)) {
            if (isRoutineReminderExpired(payload.dueDate, now)) {
                await markRoutineReminderSuperseded(
                    tx,
                    notification.id,
                    "Superseded expired Routine reminder",
                );
                return "SUPERSEDED";
            }

            await deferRoutineReminder(
                tx,
                notification.id,
                expectedScheduledFor,
            );
            return "DEFERRED";
        }

        const recipientUserIds = await resolveRoutineRecipientUserIds(
            tx,
            rule.recipientScope,
            occurrence,
        );
        if (recipientUserIds.length === 0) {
            console.warn("Routine reminder has no active recipients", {
                occurrenceId: payload.occurrenceId,
                ruleId: payload.ruleId,
            });
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded Routine reminder without active recipients",
            );
            return "SUPERSEDED";
        }

        const message = formatRoutineReminderMessage(
            occurrence.task.title,
            payload.dueDate,
            rule.daysBefore,
        );
        for (const userId of recipientUserIds) {
            await createInAppNotificationOnce(
                {
                    userId,
                    type: "ROUTINE_REMINDER",
                    title: "งานใกล้ถึงกำหนด",
                    message,
                    actionUrl: getRoutineReminderActionUrl(
                        payload.occurrenceId,
                        payload.taskId,
                    ),
                    referenceId: String(payload.occurrenceId),
                    dedupeKey: buildRoutineReminderDedupeKey(
                        payload.occurrenceId,
                        payload.ruleId,
                        userId,
                        payload.reminderVersion,
                    ),
                },
                tx,
            );
        }

        return "SENT";
    });
}
