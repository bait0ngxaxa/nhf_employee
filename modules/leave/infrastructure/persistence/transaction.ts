import type { Prisma } from "@prisma/client";
import { appendAuditInTransaction } from "@/modules/audit";
import {
    type LeaveAuditDetailsFor,
    type LeaveContractedAuditAction,
} from "@/modules/leave/domain/audit";

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
    LeaveContractedAuditAction,
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
    details: LeaveAuditDetailsFor<Action>,
): Promise<void> {
    await appendAuditInTransaction(tx, {
        action,
        entityType: "LeaveRequest",
        userId: userId ?? undefined,
        userEmail,
        details: {
            ...details,
            metadata: {
                ...details.metadata,
                leaveRequestId: leaveId,
            },
        },
    });
}
