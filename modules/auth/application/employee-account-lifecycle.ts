import type { Prisma } from "@prisma/client";

import type {
    EmployeeAccountLifecycleProvider,
    EmployeeAccountLifecycleRecord,
} from "@/modules/employee";
import { lockUserRows } from "@/lib/db/row-locks";
import {
    synchronizeAccountIdentity,
    updateAccountForEmployeeLifecycle,
} from "../infrastructure/persistence/account-repository";
import { revokeAllRefreshTokensForUserInTransaction } from "../infrastructure/persistence/refresh-token-repository";

export class EmployeeAccountLifecycleError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "EmployeeAccountLifecycleError";
        this.statusCode = statusCode;
    }
}

export async function lockEmployeeAccountForLifecycle(
    tx: Prisma.TransactionClient,
    userId: number,
): Promise<void> {
    await lockUserRows(tx, [userId]);
}

export async function assertEmployeeAccountCanDeactivate(
    tx: Prisma.TransactionClient,
    account: EmployeeAccountLifecycleRecord,
    actorUserId: number,
): Promise<void> {
    if (account.id === actorUserId) {
        throw new EmployeeAccountLifecycleError(
            "ไม่สามารถปิดใช้งานบัญชีของตนเองได้",
            403,
        );
    }
    if (account.role !== "ADMIN" || !account.isActive || account.deletedAt) return;

    const activeAdmins = await tx.user.findMany({
        where: { role: "ADMIN", isActive: true, deletedAt: null },
        select: { id: true },
    });
    await lockUserRows(tx, activeAdmins.map((admin) => admin.id));
    if (activeAdmins.length <= 1) {
        throw new EmployeeAccountLifecycleError(
            "ไม่สามารถปิดใช้งานผู้ดูแลระบบคนสุดท้ายได้",
            409,
        );
    }
}

export async function applyEmployeeAccountLifecycle(
    tx: Prisma.TransactionClient,
    input: Parameters<EmployeeAccountLifecycleProvider["applyAccountLifecycle"]>[1],
): Promise<void> {
    const deactivating = input.operation === "OFFBOARD" || input.operation === "SUSPEND";
    await updateAccountForEmployeeLifecycle(tx, {
        accountId: input.accountId,
        deactivating,
        identity: input.identity,
    });
    await revokeAllRefreshTokensForUserInTransaction(tx, input.accountId, input.revokedAt);
}

export async function synchronizeEmployeeAccountIdentity(
    tx: Prisma.TransactionClient,
    accountId: number,
    identity: { name?: string; email?: string },
): Promise<void> {
    await synchronizeAccountIdentity(tx, accountId, identity);
}

export const employeeAccountLifecycle: EmployeeAccountLifecycleProvider = {
    lockAccountForLifecycle: lockEmployeeAccountForLifecycle,
    assertAccountCanDeactivate: assertEmployeeAccountCanDeactivate,
    applyAccountLifecycle: applyEmployeeAccountLifecycle,
    synchronizeAccountIdentity: synchronizeEmployeeAccountIdentity,
};
