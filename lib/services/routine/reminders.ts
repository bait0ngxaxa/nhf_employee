import { randomUUID } from "node:crypto";

import type { NotificationOutbox, Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { z } from "zod";

import {
    sendRoutineReminderNotification,
    type RoutineReminderEmailData,
} from "@/lib/email";
import { sendRoutineLineMessage } from "@/lib/line";
import { generateRoutineReminderFlexMessage } from "@/lib/line/flex-messages/routine-reminder";
import {
    buildRoutineDashboardTaskUrl,
    buildRoutineLiffTaskUrl,
} from "@/lib/line/routine-links";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    getEmployeeBackedUserDisplayName,
    type EmployeeDisplayNameSource,
} from "@/lib/helpers/employee-helpers";
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
    routineReminderLineOutboxPayloadSchema,
    routineReminderOutboxPayloadSchema,
    type RoutineReminderEmailOutboxPayload,
    type RoutineReminderLineOutboxPayload,
    type RoutineReminderOutboxPayload,
} from "@/lib/validations/routine";

export const ROUTINE_REMINDER_OUTBOX_TYPE = "ROUTINE_REMINDER_IN_APP" as const;
export const ROUTINE_REMINDER_EMAIL_OUTBOX_TYPE = "ROUTINE_REMINDER_EMAIL" as const;
export const ROUTINE_REMINDER_LINE_OUTBOX_TYPE = "ROUTINE_REMINDER_LINE" as const;

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
                    firstName: true,
                    lastName: true,
                    nickname: true,
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
    isAssignee: boolean;
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

export function buildRoutineReminderLineEventKey(
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
    )}:line`;
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
    return `“${title}” จะครบกำหนดวันที่ ${formatRoutineReminderDueDate(dueDate)}\n${formatRoutineReminderTiming(daysBefore)}`;
}

export function formatRoutineReminderDueDate(dueDate: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(`${dueDate}T00:00:00.000+07:00`));
}

export function formatRoutineReminderTiming(daysBefore: number): string {
    return daysBefore === 0
        ? "ครบกำหนดวันนี้"
        : `เหลือเวลา ${daysBefore} วัน`;
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
    }, isAssignee: boolean, employee?: EmployeeDisplayNameSource | null): void => {
        const existing = recipients.get(user.id);
        recipients.set(user.id, {
            userId: user.id,
            email: user.email,
            name: getEmployeeBackedUserDisplayName(
                { ...user, employee },
                "ผู้รับการแจ้งเตือน",
            ),
            isAssignee: existing?.isAssignee ?? isAssignee,
        });
    };

    if (scope === "ASSIGNEES" || scope === "ASSIGNEES_AND_ADMINS") {
        snapshot.assignees.forEach(({ employee }) => {
            if (!isActiveEmployee(employee) || !employee.user || !isActiveUser(employee.user)) {
                return;
            }
            addRecipient(employee.user, true, employee);
        });
    }
    if (scope === "ADMINS" || scope === "ASSIGNEES_AND_ADMINS") {
        const admins = await tx.user.findMany({
            where: { role: Role.ADMIN, isActive: true, deletedAt: null },
            select: {
                id: true,
                email: true,
                name: true,
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                    },
                },
            },
        });
        admins.forEach((admin) => addRecipient(admin, false, admin.employee));
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

async function resolveLinkedRoutineLineRecipients(
    tx: Pick<Prisma.TransactionClient, "lineAccountLink">,
    recipients: readonly RoutineReminderRecipient[],
): Promise<RoutineReminderRecipient[]> {
    if (recipients.length === 0) return [];

    const links = (await tx.lineAccountLink.findMany({
        where: { userId: { in: recipients.map((recipient) => recipient.userId) } },
        select: { userId: true },
    })) ?? [];
    const linkedUserIds = new Set(links.map((link) => link.userId));
    return recipients.filter((recipient) => linkedUserIds.has(recipient.userId));
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

function parseRoutineReminderLinePayload(
    value: unknown,
): RoutineReminderLineOutboxPayload | null {
    const parsed = routineReminderLineOutboxPayloadSchema.safeParse(value);
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

async function supersedeInvalidRoutineLine(
    notificationId: number,
    reason: string,
): Promise<void> {
    await runSerializableTransaction(async (tx) => {
        await markRoutineReminderSuperseded(tx, notificationId, reason);
    });
}

type RoutineReminderValidationPayload = {
    occurrenceId: number;
    taskId: number;
    ruleId: number;
    reminderVersion: number;
    dueDate: string;
    daysBefore?: number;
    scheduledFor?: string;
};

type CurrentRoutineReminderState = {
    occurrence: RoutineReminderOccurrence;
    rule: RoutineReminderOccurrence["task"]["reminderRules"][number];
    currentDueDate: string;
    expectedScheduledFor: Date;
};

async function getCurrentRoutineReminderState(
    tx: Pick<Prisma.TransactionClient, "routineOccurrence">,
    payload: RoutineReminderValidationPayload,
): Promise<CurrentRoutineReminderState | null> {
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
        || (
            payload.daysBefore !== undefined
            && rule.daysBefore !== payload.daysBefore
        )
    ) {
        return null;
    }

    const expectedScheduledFor = getRoutineReminderScheduledFor(
        payload.dueDate,
        rule.daysBefore,
        rule.sendHour,
    );
    const payloadScheduledFor = payload.scheduledFor
        ? new Date(payload.scheduledFor)
        : expectedScheduledFor;
    if (
        Number.isNaN(payloadScheduledFor.getTime())
        || payloadScheduledFor.getTime() !== expectedScheduledFor.getTime()
    ) {
        return null;
    }

    return {
        occurrence,
        rule,
        currentDueDate,
        expectedScheduledFor,
    };
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

type RoutineLineDeliveryContext = {
    lineUserId: string;
    taskTitle: string;
    unitName: string;
    categoryName: string;
    dueDate: string;
    daysBefore: number;
    isAssignee: boolean;
};

async function dispatchRoutineReminderLineOutbox(
    notification: NotificationOutbox,
    value: unknown,
    now: Date,
): Promise<RoutineReminderDispatchResult> {
    const payload = parseRoutineReminderLinePayload(value);
    if (!payload) {
        await supersedeInvalidRoutineLine(
            notification.id,
            "Superseded invalid Routine reminder LINE payload",
        );
        return "SUPERSEDED";
    }

    const expectedEventKey = buildRoutineReminderLineEventKey(
        payload.occurrenceId,
        payload.ruleId,
        payload.userId,
        payload.reminderVersion,
    );
    if (notification.eventKey !== expectedEventKey) {
        await supersedeInvalidRoutineLine(
            notification.id,
            "Superseded mismatched Routine reminder LINE event key",
        );
        return "SUPERSEDED";
    }

    const prepared = await runSerializableTransaction(async (tx) => {
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notification.id, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return { kind: "SUPERSEDED" as const };

        const state = await getCurrentRoutineReminderState(tx, payload);
        if (!state) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded stale Routine reminder LINE delivery",
            );
            return { kind: "SUPERSEDED" as const };
        }

        if (!isRoutineReminderDue(
            payload.dueDate,
            state.rule.daysBefore,
            state.rule.sendHour,
            now,
        )) {
            if (isRoutineReminderExpired(payload.dueDate, now)) {
                await markRoutineReminderSuperseded(
                    tx,
                    notification.id,
                    "Superseded expired Routine reminder LINE delivery",
                );
                return { kind: "SUPERSEDED" as const };
            }

            await deferRoutineReminder(
                tx,
                notification.id,
                state.expectedScheduledFor,
            );
            return { kind: "DEFERRED" as const };
        }

        const recipient = await tx.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                role: true,
                employeeId: true,
                isActive: true,
                deletedAt: true,
                employee: {
                    select: {
                        status: true,
                        deletedAt: true,
                    },
                },
                lineAccountLink: {
                    select: { lineUserId: true },
                },
            },
        });
        const lineUserId = recipient?.lineAccountLink?.lineUserId.trim();
        if (
            !recipient
            || !isActiveUser(recipient)
            || (recipient.employee !== null && !isActiveEmployee(recipient.employee))
            || (recipient.employeeId !== null && recipient.employee === null)
            || !lineUserId
        ) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded Routine reminder LINE delivery for unavailable recipient",
            );
            return { kind: "SUPERSEDED" as const };
        }

        const isCurrentAssignee = state.occurrence.assignees.some(
            ({ employee }) => employee.user?.id === recipient.id,
        );
        if (
            (payload.isAssignee && !isCurrentAssignee)
            || (!payload.isAssignee && recipient.role !== Role.ADMIN)
            || (payload.taskTitle !== state.occurrence.task.title)
            || (payload.unitName !== state.occurrence.task.unit.name)
            || (payload.categoryName !== state.occurrence.task.category.name)
        ) {
            await markRoutineReminderSuperseded(
                tx,
                notification.id,
                "Superseded stale Routine reminder LINE recipient state",
            );
            return { kind: "SUPERSEDED" as const };
        }

        return {
            kind: "READY" as const,
            context: {
                lineUserId,
                taskTitle: state.occurrence.task.title,
                unitName: state.occurrence.task.unit.name,
                categoryName: state.occurrence.task.category.name,
                dueDate: payload.dueDate,
                daysBefore: state.rule.daysBefore,
                isAssignee: isCurrentAssignee,
            } satisfies RoutineLineDeliveryContext,
        };
    });

    if (prepared.kind !== "READY") return prepared.kind;

    const actionUrl = prepared.context.isAssignee
        ? buildRoutineLiffTaskUrl(payload.taskId, payload.occurrenceId)
        : buildRoutineDashboardTaskUrl(payload.taskId, payload.occurrenceId);
    const message = generateRoutineReminderFlexMessage({
        taskTitle: prepared.context.taskTitle,
        unitName: prepared.context.unitName,
        categoryName: prepared.context.categoryName,
        dueDateLabel: formatRoutineReminderDueDate(prepared.context.dueDate),
        timingLabel: formatRoutineReminderTiming(prepared.context.daysBefore),
        actionUrl,
    });
    const sent = await sendRoutineLineMessage(
        prepared.context.lineUserId,
        message,
        payload.retryKey,
    );
    if (!sent) {
        throw new Error("Routine LINE reminder delivery failed");
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
    if (notification.type === ROUTINE_REMINDER_LINE_OUTBOX_TYPE) {
        return dispatchRoutineReminderLineOutbox(notification, value, now);
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

        const lineRecipients = await resolveLinkedRoutineLineRecipients(
            tx,
            activeRecipients,
        );
        if (lineRecipients.length > 0) {
            await tx.notificationOutbox.createMany({
                data: lineRecipients.map((recipient) => {
                    const linePayload: RoutineReminderLineOutboxPayload = {
                        occurrenceId: payload.occurrenceId,
                        taskId: payload.taskId,
                        ruleId: payload.ruleId,
                        userId: recipient.userId,
                        reminderVersion: payload.reminderVersion,
                        taskTitle: occurrence.task.title,
                        unitName: occurrence.task.unit.name,
                        categoryName: occurrence.task.category.name,
                        dueDate: payload.dueDate,
                        daysBefore: rule.daysBefore,
                        scheduledFor: expectedScheduledFor.toISOString(),
                        isAssignee: recipient.isAssignee,
                        retryKey: randomUUID(),
                    };
                    return {
                        type: ROUTINE_REMINDER_LINE_OUTBOX_TYPE,
                        eventKey: buildRoutineReminderLineEventKey(
                            linePayload.occurrenceId,
                            linePayload.ruleId,
                            linePayload.userId,
                            linePayload.reminderVersion,
                        ),
                        payload: JSON.stringify(linePayload),
                    };
                }),
                skipDuplicates: true,
            });
        }

        return "SENT" as const;
    });

    return result;
}
