import { Prisma } from "@prisma/client";

function sortedUniqueIds(ids: readonly number[]): number[] {
    return [...new Set(ids)].sort((left, right) => left - right);
}

export async function lockUserRows(
    tx: Prisma.TransactionClient,
    userIds: readonly number[],
): Promise<void> {
    const sortedUserIds = sortedUniqueIds(userIds);
    if (sortedUserIds.length === 0) return;

    await tx.$queryRaw`
        SELECT id
        FROM users
        WHERE id IN (${Prisma.join(sortedUserIds)})
        ORDER BY id
        FOR UPDATE
    `;
}

export async function lockEmployeeRows(
    tx: Prisma.TransactionClient,
    employeeIds: readonly number[],
): Promise<void> {
    const sortedEmployeeIds = sortedUniqueIds(employeeIds);
    if (sortedEmployeeIds.length === 0) return;

    await tx.$queryRaw`
        SELECT id
        FROM employees
        WHERE id IN (${Prisma.join(sortedEmployeeIds)})
        ORDER BY id
        FOR UPDATE
    `;
}

export async function lockEmployeeLifecycleRows(
    tx: Prisma.TransactionClient,
    employeeIds: readonly number[],
    actorUserId: number,
    linkedEmployeeIds: readonly number[] = employeeIds,
): Promise<void> {
    const sortedEmployeeIds = sortedUniqueIds(employeeIds);
    const sortedLinkedEmployeeIds = sortedUniqueIds(linkedEmployeeIds);
    await lockEmployeeRows(tx, sortedEmployeeIds);

    if (sortedLinkedEmployeeIds.length === 0) {
        await lockUserRows(tx, [actorUserId]);
        return;
    }

    await tx.$queryRaw`
        SELECT id
        FROM users
        WHERE id = ${actorUserId}
            OR employeeId IN (${Prisma.join(sortedLinkedEmployeeIds)})
        ORDER BY id
        FOR UPDATE
    `;
}
