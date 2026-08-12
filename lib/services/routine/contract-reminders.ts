import { randomUUID } from "node:crypto";

import type { NotificationOutbox, Prisma } from "@prisma/client";

import {
    sendRoutineContractExpiryNotification,
    type RoutineContractExpiryEmailData,
} from "@/lib/email";
import { prisma } from "@/lib/db/prisma";
import { hasPrismaErrorCode, runSerializableTransaction } from "@/lib/db/transaction";
import { sendLineAppMessage } from "@/lib/line/messaging";
import { generateRoutineContractExpiryFlexMessage } from "@/lib/line/flex-messages/routine-contract-expiry";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    addCalendarMonths,
    calendarDateToBangkokStart,
    calendarDateToDate,
    compareCalendarDates,
    endOfMonth,
    getCurrentBangkokDate,
    getRoutineDueDateEnd,
    toBangkokCalendarDate,
    type CalendarDate,
} from "@/lib/routine/schedule";
import { createInAppNotificationOnce } from "@/lib/services/notifications/in-app";
import { APP_DASHBOARD_TABS, APP_ROUTES } from "@/lib/ssot/routes";
import {
    routineContractExpiryEmailOutboxPayloadSchema,
    routineContractExpiryLineOutboxPayloadSchema,
    routineContractExpiryOutboxPayloadSchema,
    type RoutineContractExpiryEmailOutboxPayload,
    type RoutineContractExpiryLineOutboxPayload,
    type RoutineContractExpiryOutboxPayload,
} from "@/lib/validations/routine";
import {
    isActiveRoutineEmployee,
    isActiveRoutineUser,
    resolveActiveRoutineAssigneeUserIds,
    resolveLinkedRoutineLineRecipients,
    resolveRoutineNotificationRecipients,
} from "./recipients";

export const ROUTINE_CONTRACT_EXPIRY_OUTBOX_TYPE =
    "ROUTINE_CONTRACT_EXPIRY_IN_APP" as const;
export const ROUTINE_CONTRACT_EXPIRY_EMAIL_OUTBOX_TYPE =
    "ROUTINE_CONTRACT_EXPIRY_EMAIL" as const;
export const ROUTINE_CONTRACT_EXPIRY_LINE_OUTBOX_TYPE =
    "ROUTINE_CONTRACT_EXPIRY_LINE" as const;
export const ROUTINE_CONTRACT_EXPIRY_SEND_HOUR = 9;

export interface RoutineContractExpiryEnqueueResult {
    considered: number;
    enqueued: number;
    duplicatesSkipped: number;
    noRecipientSkipped: number;
    errors: number;
}

export type RoutineContractExpiryDispatchResult =
    | "SENT"
    | "SUPERSEDED"
    | "DEFERRED"
    | null;

type OutboxMutationClient = Pick<Prisma.TransactionClient, "notificationOutbox">;

const ROUTINE_CONTRACT_TASK_SELECT = {
    id: true,
    title: true,
    isActive: true,
    contractEndDate: true,
    unit: { select: { name: true } },
    category: { select: { name: true } },
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
} as const satisfies Prisma.RoutineTaskSelect;

type RoutineContractTask = Prisma.RoutineTaskGetPayload<{
    select: typeof ROUTINE_CONTRACT_TASK_SELECT;
}>;

export function getRoutineContractExpiryNotificationDate(
    contractEndDate: CalendarDate,
): CalendarDate {
    return addCalendarMonths(contractEndDate, -1);
}

export function getRoutineContractExpiryScheduledFor(
    contractEndDate: CalendarDate,
): Date {
    const notificationDate = getRoutineContractExpiryNotificationDate(
        contractEndDate,
    );
    return new Date(
        calendarDateToBangkokStart(notificationDate).getTime()
        + ROUTINE_CONTRACT_EXPIRY_SEND_HOUR * 60 * 60 * 1000,
    );
}

export function isRoutineContractExpiryDue(
    contractEndDate: CalendarDate,
    now = new Date(),
): boolean {
    return now.getTime() >= getRoutineContractExpiryScheduledFor(
        contractEndDate,
    ).getTime() && now.getTime() < getRoutineDueDateEnd(contractEndDate).getTime();
}

export function buildRoutineContractExpiryEventKey(
    taskId: number,
    contractEndDate: CalendarDate,
): string {
    return `routine-contract:${taskId}:end:${contractEndDate}`;
}

export function buildRoutineContractExpiryDedupeKey(
    taskId: number,
    contractEndDate: CalendarDate,
    userId: number,
): string {
    return `${buildRoutineContractExpiryEventKey(taskId, contractEndDate)}:user:${userId}`;
}

export function buildRoutineContractExpiryEmailEventKey(
    taskId: number,
    contractEndDate: CalendarDate,
    userId: number,
): string {
    return `${buildRoutineContractExpiryDedupeKey(taskId, contractEndDate, userId)}:email`;
}

export function buildRoutineContractExpiryLineEventKey(
    taskId: number,
    contractEndDate: CalendarDate,
    userId: number,
): string {
    return `${buildRoutineContractExpiryDedupeKey(taskId, contractEndDate, userId)}:line`;
}

function getRoutineContractExpiryActionUrl(taskId: number): string {
    return `${APP_ROUTES.dashboard}?tab=${APP_DASHBOARD_TABS.routine}&taskId=${taskId}`;
}

function getRoutineContractExpiryAbsoluteActionUrl(taskId: number): string {
    return new URL(
        getRoutineContractExpiryActionUrl(taskId),
        getPublicOrigin(),
    ).toString();
}

function formatRoutineContractEndDate(contractEndDate: CalendarDate): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(`${contractEndDate}T00:00:00.000+07:00`));
}

function formatRoutineContractExpiryMessage(
    title: string,
    contractEndDate: CalendarDate,
): string {
    return `สัญญาของ “${title}” จะสิ้นสุดวันที่ ${formatRoutineContractEndDate(contractEndDate)}\nเหลือเวลาประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการที่เกี่ยวข้อง`;
}

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

async function markRoutineContractExpirySuperseded(
    client: OutboxMutationClient,
    notificationId: number,
    reason: string,
): Promise<void> {
    await client.notificationOutbox.updateMany({
        where: { id: notificationId, status: "PROCESSING" },
        data: { status: "SUPERSEDED", lastError: reason },
    });
}

async function deferRoutineContractExpiry(
    client: OutboxMutationClient,
    notificationId: number,
    nextAttemptAt: Date,
): Promise<void> {
    await client.notificationOutbox.updateMany({
        where: { id: notificationId, status: "PROCESSING" },
        data: { status: "PENDING", nextAttemptAt, lastError: null },
    });
}

function currentContractEndDate(task: RoutineContractTask): CalendarDate | null {
    return task.contractEndDate
        ? toBangkokCalendarDate(task.contractEndDate)
        : null;
}

function hasCurrentContract(
    task: RoutineContractTask | null,
    contractEndDate: CalendarDate,
): task is RoutineContractTask {
    return Boolean(
        task
        && task.isActive
        && currentContractEndDate(task) === contractEndDate,
    );
}

export async function enqueueDueRoutineContractExpiryReminders(
    now = new Date(),
): Promise<RoutineContractExpiryEnqueueResult> {
    const result: RoutineContractExpiryEnqueueResult = {
        considered: 0,
        enqueued: 0,
        duplicatesSkipped: 0,
        noRecipientSkipped: 0,
        errors: 0,
    };
    const today = getCurrentBangkokDate(now);
    const latestRelevantContractEndDate = endOfMonth(
        addCalendarMonths(today, 1),
    );
    const tasks = await prisma.routineTask.findMany({
        where: {
            isActive: true,
            contractEndDate: {
                not: null,
                gte: calendarDateToDate(today),
                lte: calendarDateToDate(latestRelevantContractEndDate),
            },
        },
        select: ROUTINE_CONTRACT_TASK_SELECT,
        orderBy: [{ contractEndDate: "asc" }, { id: "asc" }],
    });

    for (const task of tasks) {
        const contractEndDate = currentContractEndDate(task);
        if (!contractEndDate) continue;
        result.considered += 1;
        if (!isRoutineContractExpiryDue(contractEndDate, now)) continue;

        if (resolveActiveRoutineAssigneeUserIds(task.assignees).length === 0) {
            result.noRecipientSkipped += 1;
            continue;
        }

        const notificationDate = getRoutineContractExpiryNotificationDate(
            contractEndDate,
        );
        try {
            await prisma.notificationOutbox.create({
                data: {
                    type: ROUTINE_CONTRACT_EXPIRY_OUTBOX_TYPE,
                    eventKey: buildRoutineContractExpiryEventKey(
                        task.id,
                        contractEndDate,
                    ),
                    payload: JSON.stringify({
                        taskId: task.id,
                        contractEndDate,
                        notificationDate,
                        scheduledFor: getRoutineContractExpiryScheduledFor(
                            contractEndDate,
                        ).toISOString(),
                        createdAt: now.toISOString(),
                    } satisfies RoutineContractExpiryOutboxPayload),
                },
            });
            result.enqueued += 1;
        } catch (error) {
            if (isUniqueEventKeyConflict(error)) {
                result.duplicatesSkipped += 1;
                continue;
            }
            result.errors += 1;
            console.error("Routine contract expiry enqueue failed", {
                taskId: task.id,
                errorType: error instanceof Error ? error.name : "UnknownError",
            });
        }
    }

    return result;
}

type ContractDeliveryContext = {
    task: RoutineContractTask;
    recipient: {
        userId: number;
        email: string;
        name: string;
    };
};

async function prepareContractDelivery(
    notification: NotificationOutbox,
    payload: RoutineContractExpiryEmailOutboxPayload,
    requireValidEmail = false,
): Promise<ContractDeliveryContext | null> {
    return runSerializableTransaction(async (tx) => {
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notification.id, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return null;

        const task = await tx.routineTask.findUnique({
            where: { id: payload.taskId },
            select: ROUTINE_CONTRACT_TASK_SELECT,
        });
        if (!hasCurrentContract(task, payload.contractEndDate)) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded stale Routine contract expiry delivery",
            );
            return null;
        }

        const recipients = await resolveRoutineNotificationRecipients(
            tx,
            "ASSIGNEES",
            task.assignees,
        );
        const eligibleRecipients = requireValidEmail
            ? recipients.emailRecipients
            : recipients.activeRecipients;
        const recipient = eligibleRecipients.find(
            (candidate) => candidate.userId === payload.userId,
        );
        if (!recipient) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded Routine contract expiry delivery for unavailable recipient",
            );
            return null;
        }

        return { task, recipient };
    });
}

async function dispatchRoutineContractExpiryEmailOutbox(
    notification: NotificationOutbox,
    value: unknown,
): Promise<RoutineContractExpiryDispatchResult> {
    const parsed = routineContractExpiryEmailOutboxPayloadSchema.safeParse(value);
    if (!parsed.success) {
        await runSerializableTransaction((tx) =>
            markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded invalid Routine contract expiry email payload",
            ),
        );
        return "SUPERSEDED";
    }
    const payload = parsed.data;
    const expectedEventKey = buildRoutineContractExpiryEmailEventKey(
        payload.taskId,
        payload.contractEndDate,
        payload.userId,
    );
    if (notification.eventKey !== expectedEventKey) {
        await runSerializableTransaction((tx) =>
            markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded mismatched Routine contract expiry email event key",
            ),
        );
        return "SUPERSEDED";
    }

    const prepared = await prepareContractDelivery(notification, payload, true);
    if (!prepared) return "SUPERSEDED";
    const emailData: RoutineContractExpiryEmailData = {
        to: prepared.recipient.email,
        recipientName: prepared.recipient.name,
        taskTitle: prepared.task.title,
        unitName: prepared.task.unit.name,
        categoryName: prepared.task.category.name,
        contractEndDate: payload.contractEndDate,
        actionUrl: getRoutineContractExpiryAbsoluteActionUrl(payload.taskId),
        taskId: payload.taskId,
        userId: payload.userId,
    };
    const sent = await sendRoutineContractExpiryNotification(emailData);
    if (!sent) throw new Error("Routine contract expiry email delivery failed");
    return "SENT";
}

async function dispatchRoutineContractExpiryLineOutbox(
    notification: NotificationOutbox,
    value: unknown,
): Promise<RoutineContractExpiryDispatchResult> {
    const parsed = routineContractExpiryLineOutboxPayloadSchema.safeParse(value);
    if (!parsed.success) {
        await runSerializableTransaction((tx) =>
            markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded invalid Routine contract expiry LINE payload",
            ),
        );
        return "SUPERSEDED";
    }
    const payload = parsed.data;
    const expectedEventKey = buildRoutineContractExpiryLineEventKey(
        payload.taskId,
        payload.contractEndDate,
        payload.userId,
    );
    if (notification.eventKey !== expectedEventKey) {
        await runSerializableTransaction((tx) =>
            markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded mismatched Routine contract expiry LINE event key",
            ),
        );
        return "SUPERSEDED";
    }

    const prepared = await prepareContractDelivery(notification, payload);
    if (!prepared) return "SUPERSEDED";
    const recipient = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
            employeeId: true,
            isActive: true,
            deletedAt: true,
            employee: { select: { status: true, deletedAt: true } },
            lineAccountLink: { select: { lineUserId: true } },
        },
    });
    const lineUserId = recipient?.lineAccountLink?.lineUserId.trim();
    if (
        !recipient
        || !isActiveRoutineUser(recipient)
        || !recipient.employee
        || !isActiveRoutineEmployee(recipient.employee)
        || recipient.employeeId === null
        || !lineUserId
    ) {
        await runSerializableTransaction((tx) =>
            markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded Routine contract expiry LINE delivery for unavailable recipient",
            ),
        );
        return "SUPERSEDED";
    }

    const message = generateRoutineContractExpiryFlexMessage({
        taskTitle: prepared.task.title,
        unitName: prepared.task.unit.name,
        categoryName: prepared.task.category.name,
        contractEndDateLabel: formatRoutineContractEndDate(
            payload.contractEndDate,
        ),
        actionUrl: getRoutineContractExpiryAbsoluteActionUrl(payload.taskId),
    });
    const sent = await sendLineAppMessage(
        lineUserId,
        message,
        payload.retryKey,
    );
    if (!sent) throw new Error("Routine contract expiry LINE delivery failed");
    return "SENT";
}

export async function dispatchRoutineContractExpiryOutbox(
    notification: NotificationOutbox,
    value: unknown,
    now = new Date(),
): Promise<RoutineContractExpiryDispatchResult> {
    if (notification.type === ROUTINE_CONTRACT_EXPIRY_EMAIL_OUTBOX_TYPE) {
        return dispatchRoutineContractExpiryEmailOutbox(notification, value);
    }
    if (notification.type === ROUTINE_CONTRACT_EXPIRY_LINE_OUTBOX_TYPE) {
        return dispatchRoutineContractExpiryLineOutbox(notification, value);
    }
    if (notification.type !== ROUTINE_CONTRACT_EXPIRY_OUTBOX_TYPE) return null;

    return runSerializableTransaction(async (tx) => {
        const parsed = routineContractExpiryOutboxPayloadSchema.safeParse(value);
        if (!parsed.success) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded invalid Routine contract expiry payload",
            );
            return "SUPERSEDED";
        }
        const payload = parsed.data;
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notification.id, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return "SUPERSEDED";

        const expectedEventKey = buildRoutineContractExpiryEventKey(
            payload.taskId,
            payload.contractEndDate,
        );
        if (notification.eventKey !== expectedEventKey) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded mismatched Routine contract expiry event key",
            );
            return "SUPERSEDED";
        }

        const expectedNotificationDate = getRoutineContractExpiryNotificationDate(
            payload.contractEndDate,
        );
        const expectedScheduledFor = getRoutineContractExpiryScheduledFor(
            payload.contractEndDate,
        );
        if (
            payload.notificationDate !== expectedNotificationDate
            || new Date(payload.scheduledFor).getTime()
                !== expectedScheduledFor.getTime()
        ) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded mismatched Routine contract expiry schedule",
            );
            return "SUPERSEDED";
        }

        const task = await tx.routineTask.findUnique({
            where: { id: payload.taskId },
            select: ROUTINE_CONTRACT_TASK_SELECT,
        });
        if (!hasCurrentContract(task, payload.contractEndDate)) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded stale Routine contract expiry",
            );
            return "SUPERSEDED";
        }

        if (!isRoutineContractExpiryDue(payload.contractEndDate, now)) {
            if (
                compareCalendarDates(
                    getCurrentBangkokDate(now),
                    payload.contractEndDate,
                ) > 0
            ) {
                await markRoutineContractExpirySuperseded(
                    tx,
                    notification.id,
                    "Superseded expired Routine contract expiry",
                );
                return "SUPERSEDED";
            }
            await deferRoutineContractExpiry(
                tx,
                notification.id,
                expectedScheduledFor,
            );
            return "DEFERRED";
        }

        const { activeRecipients, emailRecipients } =
            await resolveRoutineNotificationRecipients(
                tx,
                "ASSIGNEES",
                task.assignees,
            );
        if (activeRecipients.length === 0) {
            await markRoutineContractExpirySuperseded(
                tx,
                notification.id,
                "Superseded Routine contract expiry without active recipients",
            );
            return "SUPERSEDED";
        }

        for (const recipient of activeRecipients) {
            await createInAppNotificationOnce(
                {
                    userId: recipient.userId,
                    type: "ROUTINE_CONTRACT_EXPIRY",
                    title: "สัญญาใกล้สิ้นสุด",
                    message: formatRoutineContractExpiryMessage(
                        task.title,
                        payload.contractEndDate,
                    ),
                    actionUrl: getRoutineContractExpiryActionUrl(payload.taskId),
                    referenceId: String(payload.taskId),
                    dedupeKey: buildRoutineContractExpiryDedupeKey(
                        payload.taskId,
                        payload.contractEndDate,
                        recipient.userId,
                    ),
                },
                tx,
            );
        }

        if (emailRecipients.length > 0) {
            await tx.notificationOutbox.createMany({
                data: emailRecipients.map((recipient) => ({
                    type: ROUTINE_CONTRACT_EXPIRY_EMAIL_OUTBOX_TYPE,
                    eventKey: buildRoutineContractExpiryEmailEventKey(
                        payload.taskId,
                        payload.contractEndDate,
                        recipient.userId,
                    ),
                    payload: JSON.stringify({
                        taskId: payload.taskId,
                        userId: recipient.userId,
                        contractEndDate: payload.contractEndDate,
                    } satisfies RoutineContractExpiryEmailOutboxPayload),
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
                    const linePayload: RoutineContractExpiryLineOutboxPayload = {
                        taskId: payload.taskId,
                        userId: recipient.userId,
                        contractEndDate: payload.contractEndDate,
                        retryKey: randomUUID(),
                    };
                    return {
                        type: ROUTINE_CONTRACT_EXPIRY_LINE_OUTBOX_TYPE,
                        eventKey: buildRoutineContractExpiryLineEventKey(
                            linePayload.taskId,
                            linePayload.contractEndDate,
                            linePayload.userId,
                        ),
                        payload: JSON.stringify(linePayload),
                    };
                }),
                skipDuplicates: true,
            });
        }

        return "SENT";
    });
}
