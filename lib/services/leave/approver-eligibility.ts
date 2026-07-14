import { z } from "zod";

type LeaveApproverUserState = {
    id: number;
    email: string;
    isActive: boolean;
    deletedAt: Date | null;
};

type LeaveApproverState = {
    status: string;
    deletedAt: Date | null;
    user?: LeaveApproverUserState | null;
};

export const ACTIVE_LEAVE_APPROVER_USER_SELECT = {
    id: true,
    email: true,
    isActive: true,
    deletedAt: true,
} as const;

const usableEmailSchema = z.string().trim().email();

export function isUsableLeaveEmail(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    return usableEmailSchema.safeParse(normalizedEmail).success
        && !normalizedEmail.endsWith("@temp.local");
}

export function isActiveLeaveApprover<T extends LeaveApproverState>(
    approver: T | null | undefined,
): approver is T & { user: NonNullable<T["user"]> } {
    return Boolean(
        approver
        && approver.status === "ACTIVE"
        && approver.deletedAt === null
        && approver.user?.isActive
        && approver.user.deletedAt === null
        && isUsableLeaveEmail(approver.user.email),
    );
}
