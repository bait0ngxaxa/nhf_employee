import { prisma } from "@/lib/prisma";

/**
 * Notify the requester about approval/rejection of their stock request
 */
export async function notifyStockRequestResult(
    requestId: number,
    requestedByUserId: number,
    isApproved: boolean,
    rejectReason?: string | null,
): Promise<void> {
    await prisma.notification.create({
            data: {
                userId: requestedByUserId,
                type: isApproved ? "STOCK_APPROVED" : "STOCK_REJECTED",
                title: isApproved
                    ? "คำขอเบิกวัสดุได้รับการอนุมัติ"
                    : "คำขอเบิกวัสดุถูกปฏิเสธ",
                message: isApproved
                    ? `คำขอเบิก #${requestId} ได้รับการอนุมัติแล้ว`
                    : `คำขอเบิก #${requestId} ถูกปฏิเสธ${rejectReason ? `: ${rejectReason}` : ""}`,
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
