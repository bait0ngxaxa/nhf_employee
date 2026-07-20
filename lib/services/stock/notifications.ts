import { type Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createAdminInAppNotificationsOnce } from "@/lib/services/notifications/in-app";
import {
    sendStockLowNotification,
    sendStockRequestNotification,
} from "@/lib/line";
import type {
    StockLowLineData,
    StockRequestLineData,
} from "@/types/api";
import type { LowStockAlertCandidate } from "./types";

type StockNotificationClient = Pick<
    Prisma.TransactionClient,
    "notification" | "notificationOutbox" | "user"
>;

type StockRequestLineSource = {
    id: number;
    projectCode: string;
    note: string | null;
    createdAt: Date;
    requester: {
        name: string;
        email: string;
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
    await client.notification.create({
        data: {
            userId: requestedByUserId,
            type: isIssued ? "STOCK_ISSUED" : "STOCK_CANCELLED",
            title: isIssued
                ? "คำขอเบิกวัสดุถูกจ่ายแล้ว"
                : "คำขอเบิกวัสดุถูกยกเลิก",
            message: isIssued
                ? `คำขอเบิก #${requestId} ถูกจ่ายเรียบร้อยแล้ว`
                : `คำขอเบิก #${requestId} ถูกยกเลิก${cancelReason ? `: ${cancelReason}` : ""}`,
            actionUrl: "/dashboard?tab=stock&stockTab=my-requests",
            referenceId: String(requestId),
        },
    });
}

/**
 * Notify all admins when a new stock request is created
 */
export async function notifyAdminsNewStockRequest(
    requestId: number,
    requesterName: string,
    projectCode: string,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createAdminInAppNotificationsOnce({
        type: "STOCK_REQUEST_NEW",
        title: "คำขอเบิกวัสดุใหม่",
        message: `${requesterName} ส่งคำขอเบิกวัสดุ #${requestId} (${projectCode})`,
        actionUrl: "/dashboard?tab=stock&stockTab=admin-requests",
        referenceId: String(requestId),
        dedupeKeyPrefix: `stock:${requestId}:STOCK_REQUEST_NEW`,
    }, client);
}

function buildVariantLabel(
    attributeValues: Array<{
        attributeValue: {
            value: string;
            attribute: {
                name: string;
            };
        };
    }>,
): string | undefined {
    if (attributeValues.length === 0) {
        return undefined;
    }

    return attributeValues
        .map(({ attributeValue }) => {
            return `${attributeValue.attribute.name}: ${attributeValue.value}`;
        })
        .join(", ");
}

function buildStockRequestLinePayload(
    stockRequest: StockRequestLineSource,
): StockRequestLineData {
    return {
        requestId: stockRequest.id,
        projectCode: stockRequest.projectCode,
        requesterName: stockRequest.requester.name || stockRequest.requester.email,
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

    await notifyAdminsStockRequestLineInApp(payload);
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

    await notifyAdminsLowStockInApp(payload);
    const isSent = await sendStockLowNotification(payload);

    if (!isSent) {
        throw new Error("LINE low stock notification failed");
    }
}

export async function notifyAdminsStockRequestLineInApp(
    payload: StockRequestLineData,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createAdminInAppNotificationsOnce({
        type: "STOCK_REQUEST_NEW",
        title: "คำขอเบิกวัสดุใหม่",
        message: `${payload.requesterName} ส่งคำขอเบิกวัสดุ #${payload.requestId} (${payload.projectCode})`,
        actionUrl: "/dashboard?tab=stock&stockTab=admin-requests",
        referenceId: String(payload.requestId),
        dedupeKeyPrefix: `stock:${payload.requestId}:STOCK_REQUEST_NEW`,
    }, client);
}

function buildLowStockMessage(payload: StockLowLineData): string {
    const preview = payload.items
        .slice(0, 3)
        .map((item) => `${item.name} (${item.quantity}/${item.minStock} ${item.unit})`)
        .join(", ");

    return `วัสดุ ${payload.itemCount} รายการถึงหรือต่ำกว่าจุดแจ้งเตือน${preview ? `: ${preview}` : ""}`;
}

export async function notifyAdminsLowStockInApp(
    payload: StockLowLineData,
    client: StockNotificationClient = prisma,
): Promise<void> {
    await createAdminInAppNotificationsOnce({
        type: "SYSTEM_ALERT",
        title: "วัสดุใกล้หมดสต็อก",
        message: buildLowStockMessage(payload),
        actionUrl: "/dashboard?tab=stock&stockTab=inventory",
        referenceId: payload.items[0]?.sku ?? payload.alertedAt,
        dedupeKeyPrefix: `stock-low:${payload.alertedAt}`,
    }, client);
}

export async function persistLowStockNotifications(
    alerts: LowStockAlertCandidate[],
    client: StockNotificationClient,
): Promise<void> {
    if (alerts.length === 0) return;

    const payload = buildLowStockLinePayload(alerts);

    await notifyAdminsLowStockInApp(payload, client);
    await client.notificationOutbox.create({
        data: {
            type: "STOCK_LOW_LINE",
            payload: JSON.stringify(payload),
        },
    });
}

export async function notifyAdminsStockRequestCancelledByRequester(
    requestId: number,
    requesterName: string,
    client: StockNotificationClient = prisma,
): Promise<void> {
    const admins = await client.user.findMany({
        where: { role: Role.ADMIN },
        select: { id: true },
    });

    if (admins.length === 0) return;

    await client.notification.createMany({
        data: admins.map((admin) => ({
            userId: admin.id,
            type: "STOCK_CANCELLED",
            title: "คำขอเบิกถูกผู้ใช้ยกเลิก",
            message: `${requesterName} ยกเลิกคำขอเบิก #${requestId} แล้ว`,
            actionUrl: "/dashboard?tab=stock&stockTab=admin-requests",
            referenceId: String(requestId),
        })),
    });
}
