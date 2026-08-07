import type { NotificationOutbox, Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { z } from "zod";

import {
    sendRoutineReminderNotification,
    type RoutineReminderEmailData,
} from "@/lib/email";
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
    routineReminderEmailOutboxPayloadSchema,
    routineReminderOutboxPayloadSchema,
    type RoutineReminderEmailOutboxPayload,
    type RoutineReminderOutboxPayload,
} from "@/lib/validations/routine";

export const ROUTINE_REMINDER_OUTBOX_TYPE = "ROUTINE_REMINDER_IN_APP" as const;
export const ROUTINE_REMINDER_EMAIL_OUTBOX_TYPE = "ROUTINE_REMINDER_EMAIL" as const;

export type RoutineReminderDispatchResult =
    | "SENT"
    | "SUPERSEDED"
    | "DEFERRED"
    | null;

type OutboxMutationClient = Pick<Prisma.TransactionClient, "notificationOutbox">;

const ROUTINE_REMINDER_OCCURRENCE_SELECT = {
    id: true,
    taskId: true,
    dueDate: true,
    reminderVersion: true,
    task: {
        select: {
            id: true,
            title: true,
            isActive: true,
            unit: { select: { name: true } },
            category: { select: { name: true } },
            reminderRules: {
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
                            name: true,
                            email: true,
                            isActive: true,
                            deletedAt: true,
                        },
                    },
                },
            },
        },
    },
} as const satisfies Prisma.RoutineOccurrenceSelect;

type RoutineReminderOccurrence = Prisma.RoutineOccurrenceGetPayload<{
    select: typeof ROUTINE_REMINDER_OCCURRENCE_SELECT;
}>;

type RoutineReminderRecipient = {
    userId: number;
    email: string;
    name: string;
};

type RoutineReminderRecipients = {
    activeRecipients: RoutineReminderRecipient[];
    emailRecipients: RoutineReminderRecipient[];
};

const routineReminderEmailSchema = z.string().trim().email();

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

export function buildRoutineReminderEmailEventKey(
    occurrenceId: number,
    ruleId: number,
    userId: number,
    reminderVersion: number,
): string {
    return `${buildRoutineReminderDedupeKey(
        occurrenceId,
        ruleId,
        userId,
        reminderVersion,
    )}:email`;
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

async function resolveRoutineRecipients(
    tx: Pick<Prisma.TransactionClient, "user">,
    scope: "ASSIGNEES" | "ADMINS" | "ASSIGNEES_AND_ADMINS",
    snapshot: RoutineReminderOccurrence,
): Promise<RoutineReminderRecipients> {
    const recipients = new Map<number, RoutineReminderRecipient>();
    const addRecipient = (user: {
        id: number;
        email: string;
        name: string;
    }): void => {
        recipients.set(user.id, {
            userId: user.id,
            email: user.email,
            name: user.name.trim() || "ผู้รับการแจ้งเตือน",
        });
    };

    if (scope === "ASSIGNEES" || scope === "ASSIGNEES_AND_ADMINS") {
        snapshot.assignees.forEach(({ employee }) => {
            if (!isActiveEmployee(employee) || !employee.user || !isActiveUser(employee.user)) {
                return;
            }
            addRecipient(employee.user);
        });
    }
    if (scope === "ADMINS" || scope === "ASSIGNEES_AND_ADMINS") {
        const admins = await tx.user.findMany({
            where: { role: Role.ADMIN, isActive: true, deletedAt: null },
            select: { id: true, email: true, name: true },
        });
        admins.forEach(addRecipient);
    }

    const activeRecipients = [...recipients.values()];
    const emailRecipients = activeRecipients.flatMap((recipient) => {
        if (/[\r\n]/.test(recipient.email)) {
            console.warn("Routine reminder recipient email is unavailable", {
                userId: recipient.userId,
            });
            return [];
        }

        const parsedEmail = routineReminderEmailSchema.safeParse(recipient.email);
        if (!parsedEmail.success) {
            console.warn("Routine reminder recipient email is unavailable", {
                userId: recipient.userId,
            });
            return [];
        }

        return [{ ...recipient, email: parsedEmail.data }];
    });

    return { activeRecipients, emailRecipients };
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

function parseRoutineReminderEmailPayload(
    value: unknown,
): RoutineReminderEmailOutboxPayload | null {
    const parsed = routineReminderEmailOutboxPayloadSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

async function supersedeInvalidRoutineEmail(
    notificationId: number,
    reason: string,
): Promise<void> {
    await runSerializableTransaction(async (tx) => {
        await markRoutineReminderSuperseded(tx, notificationId, reason);
    });
}

async function dispatchRoutineReminderEmailOutbox(
    notification: NotificationOutbox,
    value: unknown,
): Promise<RoutineReminderDispatchResult> {
    const payload = parseRoutineReminderEmailPayload(value);
    if (!payload) {
        await supersedeInvalidRoutineEmail(
            notification.id,
            "Superseded invalid Routine reminder email payload",
        );
        return "SUPERSEDED";
    }

    const expectedEventKey = buildRoutineReminderEmailEventKey(
        payload.occurrenceId,
        payload.ruleId,
        payload.userId,
        payload.reminderVersion,
    );
    if (notification.eventKey !== expectedEventKey) {
        await supersedeInvalidRoutineEmail(
            notification.id,
            "Superseded mismatched Routine reminder email event key",
        );
        return "SUPERSEDED";
    }

    const sent = await sendRoutineReminderNotification(payload);
    if (!sent) {
        throw new Error("Routine reminder email delivery failed");
    }
    return "SENT";
}

export async function dispatchRoutineReminderOutbox(
    notification: NotificationOutbox,
    value: unknown,
    now = new Date(),
): Promise<RoutineReminderDispatchResult> {
    if (notification.type === ROUTINE_REMINDER_EMAIL_OUTBOX_TYPE) {
        return dispatchRoutineReminderEmailOutbox(notification, value);
    }
    if (notification.type !== ROUTINE_REMINDER_OUTBOX_TYPE) return null;

    const result = await runSerializableTransaction(async (tx) => {
        const payload = parseRoutineReminderPayload(value);
        if (!payload) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded invalid Routine reminder payload",
            );
            return "SUPERSEDED" as const;
        }

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
            select: ROUTINE_REMINDER_OCCURRENCE_SELECT,
        });
        const rule = occurrence?.task.reminderRules.find(
            (candidate) => candidate.id === payload.ruleId,
        );
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

        const { activeRecipients, emailRecipients } = await resolveRoutineRecipients(
            tx,
            rule.recipientScope,
            occurrence,
        );
        if (activeRecipients.length === 0) {
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
        for (const recipient of activeRecipients) {
            await createInAppNotificationOnce(
                {
                    userId: recipient.userId,
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
                        recipient.userId,
                        payload.reminderVersion,
                    ),
                },
                tx,
            );
        }

        const emailDeliveries: RoutineReminderEmailData[] = emailRecipients.map(
            (recipient) => ({
                to: recipient.email,
                recipientName: recipient.name,
                taskTitle: occurrence.task.title,
                unitName: occurrence.task.unit.name,
                categoryName: occurrence.task.category.name,
                dueDate: payload.dueDate,
                daysBefore: rule.daysBefore,
                actionUrl: getRoutineReminderActionUrl(
                    payload.occurrenceId,
                    payload.taskId,
                ),
                occurrenceId: payload.occurrenceId,
                ruleId: payload.ruleId,
                userId: recipient.userId,
                reminderVersion: payload.reminderVersion,
            }),
        );

        if (emailDeliveries.length > 0) {
            await tx.notificationOutbox.createMany({
                data: emailDeliveries.map((emailDelivery) => ({
                    type: ROUTINE_REMINDER_EMAIL_OUTBOX_TYPE,
                    eventKey: buildRoutineReminderEmailEventKey(
                        emailDelivery.occurrenceId,
                        emailDelivery.ruleId,
                        emailDelivery.userId,
                        emailDelivery.reminderVersion,
                    ),
                    payload: JSON.stringify(emailDelivery),
                })),
                skipDuplicates: true,
            });
        }

        return "SENT" as const;
    });

    return result;
}
