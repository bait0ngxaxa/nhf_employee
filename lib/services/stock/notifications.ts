import { prisma } from "@/lib/prisma";

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
            actionUrl: "/dashboard?tab=it-equipment&stockTab=my-requests",
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
                message: `${requesterName} ส่งคำขอเบิกวัสดุ #${requestId}`,
                actionUrl: "/dashboard?tab=it-equipment&stockTab=admin-requests",
                referenceId: String(requestId),
            })),
    });
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
            actionUrl: "/dashboard?tab=it-equipment&stockTab=admin-requests",
            referenceId: String(requestId),
        })),
    });
}
