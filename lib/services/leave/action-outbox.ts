import type { NotificationOutboxStatus, Prisma } from "@prisma/client";

type TransferOutbox = {
    id: number;
    payload: string;
    status: NotificationOutboxStatus;
};

type TransferLeaveActionInput = {
    leaveId: string;
    approverUserId: number;
    payload: string;
    current: TransferOutbox[];
};

async function supersedeDuplicates(
    tx: Prisma.TransactionClient,
    duplicates: TransferOutbox[],
): Promise<void> {
    if (duplicates.length === 0) return;
    await tx.notificationOutbox.updateMany({
        where: {
            id: { in: duplicates.map(({ id }) => id) },
            status: { in: ["PENDING", "FAILED"] },
        },
        data: {
            status: "SUPERSEDED",
            lastError: "Superseded by approver transfer",
        },
    });
}

export async function transferLeaveActionNotification(
    tx: Prisma.TransactionClient,
    input: TransferLeaveActionInput,
): Promise<void> {
    await tx.notification.updateMany({
        where: {
            type: "LEAVE_REQUESTED",
            referenceId: input.leaveId,
            userId: { not: input.approverUserId },
            isRead: false,
        },
        data: { isRead: true },
    });
    const rewritable = input.current.filter(
        ({ status }) => status === "PENDING" || status === "FAILED",
    );
    const [primary, ...duplicates] = rewritable;
    const rewritten = primary && await tx.notificationOutbox.updateMany({
        where: { id: primary.id, status: { in: ["PENDING", "FAILED"] } },
        data: { payload: input.payload },
    });
    if (rewritten?.count === 1) {
        await supersedeDuplicates(tx, duplicates);
        return;
    }
    await tx.notificationOutbox.create({
        data: { type: "LEAVE_ACTION", payload: input.payload },
    });
}
