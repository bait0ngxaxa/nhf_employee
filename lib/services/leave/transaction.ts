import type { Prisma } from "@prisma/client";

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
