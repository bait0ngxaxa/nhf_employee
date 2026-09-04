export function isRoutineNotificationReady(employee: {
    status: string;
    deletedAt: Date | null;
    user: { isActive: boolean; deletedAt: Date | null } | null;
}): boolean {
    return employee.status === "ACTIVE"
        && employee.deletedAt === null
        && employee.user !== null
        && employee.user.isActive
        && employee.user.deletedAt === null;
}
