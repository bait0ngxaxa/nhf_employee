import type { Prisma } from "@prisma/client";

import { lockEmployeeRows } from "@/lib/services/leave/transaction";

export async function isActiveEmployeeInTransaction(
    tx: Prisma.TransactionClient,
    userId: number,
    employeeId: number,
): Promise<boolean> {
    await lockEmployeeRows(tx, [employeeId]);

    const user = await tx.user.findFirst({
        where: {
            id: userId,
            employeeId,
            isActive: true,
            deletedAt: null,
            employee: {
                is: { status: "ACTIVE", deletedAt: null },
            },
        },
        select: { id: true },
    });

    return user !== null;
}

export async function isEmployeeInTransaction(
    tx: Prisma.TransactionClient,
    employeeId: number,
): Promise<boolean> {
    const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
    });
    return employee !== null;
}
