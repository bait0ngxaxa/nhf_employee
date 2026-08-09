import type { Prisma } from "@prisma/client";
import type {
    AuditDetailsFor,
    ContractedAuditAction,
} from "@/lib/audit-log/contracts";

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

type LeaveTransactionAuditAction = Extract<
    ContractedAuditAction,
    `LEAVE_REQUEST_${string}`
>;

export async function createLeaveAuditInTransaction<
    Action extends LeaveTransactionAuditAction,
>(
    tx: Prisma.TransactionClient,
    action: Action,
    leaveId: string,
    userId: number | null,
    userEmail: string,
    details: AuditDetailsFor<Action>,
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
