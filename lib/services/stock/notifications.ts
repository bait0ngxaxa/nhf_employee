import { prisma } from "@/lib/prisma";
import {
    sendStockLowNotification,
    sendStockRequestNotification,
} from "@/lib/line";
import type {
    StockLowLineData,
    StockRequestLineData,
} from "@/types/api";
import type { LowStockAlertCandidate } from "./types";

/**
 * Notify the requester about issued/cancelled stock requests
 */
export async function notifyStockRequestResult(
    requestId: number,
    requestedByUserId: number,
    isIssued: boolean,
    cancelReason?: string | null,
): Promise<void> {
    await prisma.notification.create({
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
): Promise<void> {
    const admins = await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true },
    });

    if (admins.length === 0) return;

    await prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.id,
                type: "STOCK_REQUEST_NEW",
                title: "คำขอเบิกวัสดุใหม่",
                message: `${requesterName} ส่งคำขอเบิกวัสดุ #${requestId} (${projectCode})`,
                actionUrl: "/dashboard?tab=stock&stockTab=admin-requests",
                referenceId: String(requestId),
            })),
    });
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

export async function enqueueLineNewStockRequest(
    stockRequest: {
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
    },
): Promise<void> {
    const payload: StockRequestLineData = {
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

    await prisma.notificationOutbox.create({
        data: {
            type: "STOCK_REQUEST_LINE",
            payload: JSON.stringify(payload),
        },
    });
}

export async function notifyLineNewStockRequest(
    stockRequest: {
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
    },
): Promise<void> {
    const payload: StockRequestLineData = {
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

    const isSent = await sendStockRequestNotification(payload);

    if (!isSent) {
        throw new Error("LINE stock notification failed");
    }
}

export async function enqueueLineLowStockReached(
    alerts: LowStockAlertCandidate[],
): Promise<void> {
    if (alerts.length === 0) {
        return;
    }

    const payload: StockLowLineData = {
        alertedAt: new Date().toISOString(),
        itemCount: alerts.length,
        items: alerts.map((alert) => ({
            itemId: alert.itemId,
            name: alert.name,
            sku: alert.sku,
            quantity: alert.quantity,
            minStock: alert.minStock,
            unit: alert.unit,
        })),
    };

    await prisma.notificationOutbox.create({
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

    const payload: StockLowLineData = {
        alertedAt: new Date().toISOString(),
        itemCount: alerts.length,
        items: alerts.map((alert) => ({
            itemId: alert.itemId,
            name: alert.name,
            sku: alert.sku,
            quantity: alert.quantity,
            minStock: alert.minStock,
            unit: alert.unit,
        })),
    };

    const isSent = await sendStockLowNotification(payload);

    if (!isSent) {
        throw new Error("LINE low stock notification failed");
    }
}

export async function notifyAdminsStockRequestCancelledByRequester(
    requestId: number,
    requesterName: string,
): Promise<void> {
    const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
    });

    if (admins.length === 0) return;

    await prisma.notification.createMany({
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
