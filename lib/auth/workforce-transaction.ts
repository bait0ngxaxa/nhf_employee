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
): Promise<void> {
    await lockUserRows(tx, [userId]);

    const user = await tx.user.findUnique({
        where: { id: userId },
        select: { employeeId: true },
    });
    if (!user?.employeeId) {
        throw new WorkforceAuthorizationError();
    }

    await lockEmployeeRows(tx, [user.employeeId]);

    const activeUser = await tx.user.findFirst({
        where: {
            id: userId,
            employeeId: user.employeeId,
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
