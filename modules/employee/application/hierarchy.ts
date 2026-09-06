import type { Prisma } from "@prisma/client";

export interface EmployeeManagerChange {
    employeeId: number;
    managerId: number | null;
}

export async function applyEmployeeManagerChangesInTransaction(
    tx: Prisma.TransactionClient,
    changes: readonly EmployeeManagerChange[],
): Promise<void> {
    for (const change of changes) {
        await tx.employee.update({
            where: { id: change.employeeId },
            data: { managerId: change.managerId },
        });
    }
}
