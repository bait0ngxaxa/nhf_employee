import type { Prisma } from "@prisma/client";

import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";

export class WorkforceAuthorizationError extends Error {
    constructor() {
        super("ไม่มีสิทธิ์ดำเนินการสำหรับสถานะพนักงานปัจจุบัน");
        this.name = "WorkforceAuthorizationError";
    }
}

export async function assertActiveWorkforceInTransaction(
    tx: Prisma.TransactionClient,
    userId: number,
    employeeId: number | null,
): Promise<void> {
    if (employeeId === null) {
        throw new WorkforceAuthorizationError();
    }

    await lockEmployeeRows(tx, [employeeId]);
    await lockUserRows(tx, [userId]);

    const activeUser = await tx.user.findFirst({
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
    if (!activeUser) {
        throw new WorkforceAuthorizationError();
    }
}
