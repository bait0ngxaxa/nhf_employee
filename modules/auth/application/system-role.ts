import type { EmployeeStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { appendAuditInTransaction } from "@/modules/audit";
import { lockUserRows } from "@/lib/db/row-locks";
import { runSerializableTransaction } from "@/lib/db/transaction";
import type { UserRole } from "@/lib/ssot/permissions";

export const systemRoleChangeSchema = z.strictObject({
    systemRole: z.enum(["USER", "ADMIN"]),
});

export type SystemRoleChangeInput = z.infer<typeof systemRoleChangeSchema>;

export interface SystemRoleChangeActor {
    readonly userId: number;
    readonly userEmail: string | null;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
}

export type SystemRoleChangeErrorCode =
    | "INVALID_INPUT"
    | "NOT_FOUND"
    | "TARGET_NOT_ELIGIBLE"
    | "LAST_ELIGIBLE_ADMIN"
    | "SELF_DEMOTION"
    | "NO_STATE_CHANGE";

export class SystemRoleChangeError extends Error {
    readonly code: SystemRoleChangeErrorCode;
    readonly statusCode: number;

    constructor(
        code: SystemRoleChangeErrorCode,
        message: string,
        statusCode: number,
    ) {
        super(message);
        this.name = "SystemRoleChangeError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

interface SystemRoleAccountState {
    readonly id: number;
    readonly role: UserRole;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: {
        readonly status: EmployeeStatus;
        readonly deletedAt: Date | null;
    } | null;
}

const SYSTEM_ROLE_ACCOUNT_SELECT = {
    id: true,
    role: true,
    isActive: true,
    deletedAt: true,
    employee: {
        select: {
            status: true,
            deletedAt: true,
        },
    },
} as const satisfies Prisma.UserSelect;

const ELIGIBLE_ACTIVE_ADMIN_WHERE = {
    role: "ADMIN",
    isActive: true,
    deletedAt: null,
    employee: {
        is: {
            status: "ACTIVE",
            deletedAt: null,
        },
    },
} as const satisfies Prisma.UserWhereInput;

export function isEligibleActiveControlPlaneAccount(
    account: Pick<SystemRoleAccountState, "isActive" | "deletedAt" | "employee">,
): boolean {
    return account.isActive
        && account.deletedAt === null
        && account.employee !== null
        && account.employee.status === "ACTIVE"
        && account.employee.deletedAt === null;
}

export function isEligibleActiveSystemAdmin(
    account: SystemRoleAccountState,
): boolean {
    return account.role === "ADMIN"
        && isEligibleActiveControlPlaneAccount(account);
}

async function findSystemRoleAccount(
    tx: Prisma.TransactionClient,
    userId: number,
): Promise<SystemRoleAccountState | null> {
    return tx.user.findUnique({
        where: { id: userId },
        select: SYSTEM_ROLE_ACCOUNT_SELECT,
    });
}

async function findEligibleActiveAdminIds(
    tx: Prisma.TransactionClient,
): Promise<number[]> {
    const admins = await tx.user.findMany({
        where: ELIGIBLE_ACTIVE_ADMIN_WHERE,
        select: { id: true },
        orderBy: { id: "asc" },
    });
    return admins.map((admin) => admin.id);
}

/**
 * The caller must already hold the target User row lock. The eligible set is
 * locked in deterministic order, then queried again so a demotion cannot
 * remove the final usable control-plane administrator.
 */
export async function assertEligibleSystemAdminRemovalSafe(
    tx: Prisma.TransactionClient,
    targetUserId: number,
): Promise<void> {
    const eligibleBeforeLock = await findEligibleActiveAdminIds(tx);
    await lockUserRows(tx, eligibleBeforeLock);
    const eligibleAfterLock = await findEligibleActiveAdminIds(tx);
    if (
        eligibleAfterLock.length === 1
        && eligibleAfterLock[0] === targetUserId
    ) {
        throw new SystemRoleChangeError(
            "LAST_ELIGIBLE_ADMIN",
            "ไม่สามารถถอดผู้ดูแลระบบคนสุดท้ายที่ใช้งานได้",
            409,
        );
    }
}

function invalidInput(message: string): SystemRoleChangeError {
    return new SystemRoleChangeError("INVALID_INPUT", message, 400);
}

function assertPositiveSafeInteger(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw invalidInput(`${label} ไม่ถูกต้อง`);
    }
}

export interface SystemRoleChangeResult {
    readonly userId: number;
    readonly before: UserRole;
    readonly after: UserRole;
}

export async function changeSystemRole(input: {
    readonly targetUserId: number;
    readonly systemRole: SystemRoleChangeInput["systemRole"];
    readonly actor: SystemRoleChangeActor;
}): Promise<SystemRoleChangeResult> {
    assertPositiveSafeInteger(input.targetUserId, "รหัสผู้ใช้");
    assertPositiveSafeInteger(input.actor.userId, "รหัสผู้ดำเนินการ");
    const parsed = systemRoleChangeSchema.safeParse({ systemRole: input.systemRole });
    if (!parsed.success) {
        throw invalidInput("บทบาทระบบไม่ถูกต้อง");
    }

    return runSerializableTransaction(async (tx) => {
        await lockUserRows(tx, [input.targetUserId]);
        let target = await findSystemRoleAccount(tx, input.targetUserId);
        if (!target) {
            throw new SystemRoleChangeError(
                "NOT_FOUND",
                "ไม่พบผู้ใช้ที่ต้องการเปลี่ยนบทบาทระบบ",
                404,
            );
        }
        if (target.role === parsed.data.systemRole) {
            throw new SystemRoleChangeError(
                "NO_STATE_CHANGE",
                "บทบาทระบบของผู้ใช้นี้เป็นค่าที่ร้องขออยู่แล้ว",
                409,
            );
        }

        if (parsed.data.systemRole === "ADMIN") {
            if (!isEligibleActiveControlPlaneAccount(target)) {
                throw new SystemRoleChangeError(
                    "TARGET_NOT_ELIGIBLE",
                    "ผู้ใช้ต้องเป็นบัญชีที่ใช้งานอยู่และเชื่อมกับพนักงานที่ใช้งานอยู่ก่อนแต่งตั้งเป็นผู้ดูแลระบบ",
                    409,
                );
            }
        } else {
            if (input.actor.userId === target.id) {
                throw new SystemRoleChangeError(
                    "SELF_DEMOTION",
                    "ไม่อนุญาตให้ผู้ดูแลระบบถอดบทบาทของตนเองจาก session นี้",
                    403,
                );
            }
            await assertEligibleSystemAdminRemovalSafe(tx, target.id);
            target = await findSystemRoleAccount(tx, target.id);
            if (!target) {
                throw new SystemRoleChangeError(
                    "NOT_FOUND",
                    "ไม่พบผู้ใช้ที่ต้องการเปลี่ยนบทบาทระบบ",
                    404,
                );
            }
        }

        await tx.user.update({
            where: { id: target.id },
            data: { role: parsed.data.systemRole },
        });
        await appendAuditInTransaction(tx, {
            action: "USER_ROLE_CHANGE",
            entityType: "User",
            entityId: target.id,
            userId: input.actor.userId,
            userEmail: input.actor.userEmail,
            ipAddress: input.actor.ipAddress,
            userAgent: input.actor.userAgent,
            details: {
                before: { systemRole: target.role },
                after: { systemRole: parsed.data.systemRole },
                metadata: { targetUserId: target.id },
            },
        });

        return {
            userId: target.id,
            before: target.role,
            after: parsed.data.systemRole,
        };
    });
}
