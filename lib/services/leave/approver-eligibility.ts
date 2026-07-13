type LeaveApproverUserState = {
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

export function isActiveLeaveApprover<T extends LeaveApproverState>(
    approver: T | null | undefined,
): approver is T & { user: NonNullable<T["user"]> } {
    return Boolean(
        approver
        && approver.status === "ACTIVE"
        && approver.deletedAt === null
        && approver.user?.isActive
        && approver.user.deletedAt === null,
    );
}
