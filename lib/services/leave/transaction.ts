import type { AuditAction, Prisma } from "@prisma/client";

export { lockEmployeeRows } from "@/lib/db/row-locks";

export async function lockLeaveRequestRow(
    tx: Prisma.TransactionClient,
    leaveId: string,
): Promise<void> {
    await tx.$queryRaw`
        SELECT id
        FROM leave_requests
        WHERE id = ${leaveId}
        FOR UPDATE
    `;
}

export type LeaveTransactionAuditDetails = {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
};

export async function createLeaveAuditInTransaction(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    leaveId: string,
    userId: number | null,
    userEmail: string,
    details: LeaveTransactionAuditDetails = {},
): Promise<void> {
    await tx.auditLog.create({
        data: {
            action,
            entityType: "LeaveRequest",
            userId: userId ?? undefined,
            userEmail,
            details: JSON.stringify({
                ...details,
                metadata: {
                    ...details.metadata,
                    leaveRequestId: leaveId,
                },
            }),
        },
    });
}
