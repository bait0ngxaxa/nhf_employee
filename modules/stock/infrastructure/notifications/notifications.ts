import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getUserDisplayName } from "@/shared/identity/display";
import {
    findActiveUsersWithConfiguredCapabilityScope,
    type AuthorizationPersistenceContext,
} from "@/modules/authorization";
import {
    createForUser,
    createForUserOnce,
    createForUsers,
    type NotificationCreateInput,
    type NotificationPersistenceContext,
} from "@/modules/notification";
import {
    sendStockLowNotification,
    sendStockRequestNotification,
} from "./line-notifications";
import type {
    StockLowLineData,
    StockRequestLineData,
} from "../../contracts/notifications";
import { toDashboardStockTabPath, STOCK_DASHBOARD_TABS } from "@/lib/ssot/routes";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";
import {
    buildVariantLabel,
    type StockRequestResultEmailPayload,
} from "./notification-payloads";
import { buildStockRequestResultLineEventKey } from "./line-notifications";
import type { LowStockAlertCandidate } from "../../domain/types";

type StockNotificationClient = Pick<
    Prisma.TransactionClient,
    "notificationOutbox"
> & NotificationPersistenceContext & AuthorizationPersistenceContext;

type StockRequestLineSource = {
    id: number;
    projectCode: string;
    note: string | null;
    createdAt: Date;
    requester: {
        name: string;
        email: string;
        employee?: {
            firstName: string;
            lastName: string;
            nickname: string | null;
        } | null;
    };
    items: Array<{
        quantity: number;
        item: {
            name: string;
            unit: string;
        };
        variant: {
            unit: string;
            attributeValues: Array<{
                attributeValue: {
                    value: string;
                    attribute: {
                        name: string;
                    };
                };
            }>;
        } | null;
    }>;
};

/**
 * Notify the requester about issued/cancelled stock requests
 */
export async function notifyStockRequestResult(
    requestId: number,
    requestedByUserId: number,
    isIssued: boolean,
    cancelReason?: string | null,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createForUser({
        userId: requestedByUserId,
        type: isIssued ? "STOCK_ISSUED" : "STOCK_CANCELLED",
        title: isIssued
            ? "คำขอเบิกวัสดุถูกจ่ายแล้ว"
            : "คำขอเบิกวัสดุถูกยกเลิก",
        message: isIssued
            ? `คำขอเบิก #${requestId} ถูกจ่ายเรียบร้อยแล้ว`
            : `คำขอเบิก #${requestId} ถูกยกเลิก${cancelReason ? `: ${cancelReason}` : ""}`,
        actionUrl: toDashboardStockTabPath(STOCK_DASHBOARD_TABS.myRequests),
        referenceId: String(requestId),
    }, client);
}

async function findStockCapabilityRecipients(
    capability: "stock.request.process" | "stock.inventory.manage",
    client: StockNotificationClient,
): Promise<readonly number[]> {
    return findActiveUsersWithConfiguredCapabilityScope(
        { capability, scope: "ALL" },
        client,
    );
}

async function createForCapabilityRecipients(
    input: Omit<NotificationCreateInput, "userId" | "dedupeKey">,
    capability: "stock.request.process" | "stock.inventory.manage",
    dedupeKeyPrefix: string,
    client: StockNotificationClient,
): Promise<void> {
    const recipientUserIds = await findStockCapabilityRecipients(
        capability,
        client,
    );

    await Promise.all(
        recipientUserIds.map((userId) =>
            createForUserOnce({
                ...input,
                userId,
                dedupeKey: `${dedupeKeyPrefix}:${userId}`,
            }, client),
        ),
    );
}

export async function enqueueStockRequestResultEmail(
    payload: StockRequestResultEmailPayload,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await client.notificationOutbox.createMany({
        data: [{
            type: "STOCK_REQUEST_RESULT_EMAIL",
            eventKey: `stock-request:${payload.requestId}:${payload.status}:email`,
            payload: JSON.stringify(payload),
        }],
        skipDuplicates: true,
    });
}

export async function enqueueStockRequestResultLine(
    payload: StockRequestResultEmailPayload,
    client: StockNotificationClient = prisma,
): Promise<void> {
    const eventKey = buildStockRequestResultLineEventKey(
        payload.requestId,
        payload.status,
    );
    const linePayload = {
        ...payload,
        retryKey: createLineRetryKey(eventKey),
    };

    await client.notificationOutbox.createMany({
        data: [{
            type: "STOCK_REQUEST_RESULT_LINE",
            eventKey,
            payload: JSON.stringify(linePayload),
        }],
        skipDuplicates: true,
    });
}

/**
 * Notify configured Stock request processors when a new request is created.
 */
export async function notifyStockRequestProcessorsNewRequest(
    requestId: number,
    requesterName: string,
    projectCode: string,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createForCapabilityRecipients({
        type: "STOCK_REQUEST_NEW",
        title: "คำขอเบิกวัสดุใหม่",
        message: `${requesterName} ส่งคำขอเบิกวัสดุ #${requestId} (${projectCode})`,
        actionUrl: toDashboardStockTabPath(STOCK_DASHBOARD_TABS.adminRequests),
        referenceId: String(requestId),
    }, "stock.request.process", `stock:${requestId}:STOCK_REQUEST_NEW`, client);
}

export { buildVariantLabel } from "./notification-payloads";

function buildStockRequestLinePayload(
    stockRequest: StockRequestLineSource,
): StockRequestLineData {
    return {
        requestId: stockRequest.id,
        projectCode: stockRequest.projectCode,
        requesterName: getUserDisplayName(stockRequest.requester),
        note: stockRequest.note,
        requestedAt: stockRequest.createdAt.toISOString(),
        itemCount: stockRequest.items.length,
        totalQuantity: stockRequest.items.reduce(
            (sum, item) => sum + item.quantity,
            0,
        ),
        items: stockRequest.items.map((item) => ({
            name: item.item.name,
            quantity: item.quantity,
            unit: item.variant?.unit ?? item.item.unit,
            variantLabel: item.variant
                ? buildVariantLabel(item.variant.attributeValues)
                : undefined,
        })),
    };
}

export async function enqueueLineNewStockRequest(
    stockRequest: StockRequestLineSource,
    client: StockNotificationClient = prisma,
): Promise<void> {
    const payload = buildStockRequestLinePayload(stockRequest);

    await client.notificationOutbox.create({
        data: {
            type: "STOCK_REQUEST_LINE",
            payload: JSON.stringify(payload),
        },
    });
}

export async function notifyLineNewStockRequest(
    stockRequest: StockRequestLineSource,
): Promise<void> {
    const payload = buildStockRequestLinePayload(stockRequest);

    await notifyStockRequestProcessorsLineInApp(payload);
    const isSent = await sendStockRequestNotification(payload);

    if (!isSent) {
        throw new Error("LINE stock notification failed");
    }
}

function buildLowStockLinePayload(
    alerts: LowStockAlertCandidate[],
): StockLowLineData {
    return {
        alertedAt: new Date().toISOString(),
        itemCount: alerts.length,
        items: alerts.map((alert) => ({ ...alert })),
    };
}

export async function enqueueLineLowStockReached(
    alerts: LowStockAlertCandidate[],
    client: StockNotificationClient = prisma,
): Promise<void> {
    if (alerts.length === 0) {
        return;
    }

    const payload = buildLowStockLinePayload(alerts);

    await client.notificationOutbox.create({
        data: {
            type: "STOCK_LOW_LINE",
            payload: JSON.stringify(payload),
        },
    });
}

export async function notifyLineLowStockReached(
    alerts: LowStockAlertCandidate[],
): Promise<void> {
    if (alerts.length === 0) {
        return;
    }

    const payload = buildLowStockLinePayload(alerts);

    await notifyInventoryManagersLowStockInApp(payload);
    const isSent = await sendStockLowNotification(payload);

    if (!isSent) {
        throw new Error("LINE low stock notification failed");
    }
}

export async function notifyStockRequestProcessorsLineInApp(
    payload: StockRequestLineData,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createForCapabilityRecipients({
        type: "STOCK_REQUEST_NEW",
        title: "คำขอเบิกวัสดุใหม่",
        message: `${payload.requesterName} ส่งคำขอเบิกวัสดุ #${payload.requestId} (${payload.projectCode})`,
        actionUrl: toDashboardStockTabPath(STOCK_DASHBOARD_TABS.adminRequests),
        referenceId: String(payload.requestId),
    }, "stock.request.process", `stock:${payload.requestId}:STOCK_REQUEST_NEW`, client);
}

function buildLowStockMessage(payload: StockLowLineData): string {
    const preview = payload.items
        .slice(0, 3)
        .map((item) => {
            const name = "variantId" in item
                ? `${item.itemName} (${item.variantLabel})`
                : item.name;
            return `${name} (${item.quantity}/${item.minStock} ${item.unit})`;
        })
        .join(", ");

    return `วัสดุ ${payload.itemCount} รายการถึงหรือต่ำกว่าจุดแจ้งเตือน${preview ? `: ${preview}` : ""}`;
}

export async function notifyInventoryManagersLowStockInApp(
    payload: StockLowLineData,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createForCapabilityRecipients({
        type: "SYSTEM_ALERT",
        title: "วัสดุใกล้หมดสต็อก",
        message: buildLowStockMessage(payload),
        actionUrl: toDashboardStockTabPath(STOCK_DASHBOARD_TABS.inventory),
        referenceId: payload.items[0]
            ? ("variantId" in payload.items[0]
                ? payload.items[0].variantSku
                : payload.items[0].sku)
            : payload.alertedAt,
    }, "stock.inventory.manage", `stock-low:${payload.alertedAt}`, client);
}

export async function persistLowStockNotifications(
    alerts: LowStockAlertCandidate[],
    client: StockNotificationClient,
): Promise<void> {
    if (alerts.length === 0) return;

    const payload = buildLowStockLinePayload(alerts);

    await notifyInventoryManagersLowStockInApp(payload, client);
    await client.notificationOutbox.create({
        data: {
            type: "STOCK_LOW_LINE",
            payload: JSON.stringify(payload),
        },
    });
}

export async function notifyStockRequestProcessorsRequestCancelledByRequester(
    requestId: number,
    requesterName: string,
    client: StockNotificationClient = prisma,
): Promise<void> {
    const recipientUserIds = await findStockCapabilityRecipients(
        "stock.request.process",
        client,
    );

    if (recipientUserIds.length === 0) return;

    const inputs: NotificationCreateInput[] = recipientUserIds.map((userId) => ({
            userId,
            type: "STOCK_CANCELLED",
            title: "คำขอเบิกถูกผู้ใช้ยกเลิก",
            message: `${requesterName} ยกเลิกคำขอเบิก #${requestId} แล้ว`,
            actionUrl: toDashboardStockTabPath(STOCK_DASHBOARD_TABS.adminRequests),
            referenceId: String(requestId),
        }));

    await createForUsers(inputs, client);
}
