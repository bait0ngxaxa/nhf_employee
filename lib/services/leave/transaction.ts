import { Prisma } from "@prisma/client";

export async function lockEmployeeRows(
    tx: Prisma.TransactionClient,
    employeeIds: readonly number[],
): Promise<void> {
    const sortedEmployeeIds = [...new Set(employeeIds)].sort((left, right) => left - right);
    if (sortedEmployeeIds.length === 0) return;

    await tx.$queryRaw`
        SELECT id
        FROM employees
        WHERE id IN (${Prisma.join(sortedEmployeeIds)})
        ORDER BY id
        FOR UPDATE
    `;
}

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
