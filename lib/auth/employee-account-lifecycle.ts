import type { Prisma } from "@prisma/client";

import { lockUserRows } from "@/lib/db/row-locks";

export interface LockedEmployeeAccount {
    id: number;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    deletedAt: Date | null;
}

export type EmployeeAccountLifecycleOperation = "OFFBOARD" | "SUSPEND" | "REACTIVATE";

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
    account: LockedEmployeeAccount,
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
    input: {
        accountId: number;
        operation: EmployeeAccountLifecycleOperation;
        identity: { name?: string; email?: string };
        revokedAt: Date;
    },
): Promise<void> {
    const deactivating = input.operation === "OFFBOARD" || input.operation === "SUSPEND";
    await tx.user.update({
        where: { id: input.accountId },
        data: deactivating
            ? { ...input.identity, isActive: false, tokenVersion: { increment: 1 } }
            : {
                ...input.identity,
                isActive: true,
                deletedAt: null,
                tokenVersion: { increment: 1 },
            },
    });
    await tx.authRefreshToken.updateMany({
        where: { userId: input.accountId, revokedAt: null },
        data: { revokedAt: input.revokedAt },
    });
}

export async function synchronizeEmployeeAccountIdentity(
    tx: Prisma.TransactionClient,
    accountId: number,
    identity: { name?: string; email?: string },
): Promise<void> {
    if (Object.keys(identity).length === 0) return;
    await tx.user.update({ where: { id: accountId }, data: identity });
}
