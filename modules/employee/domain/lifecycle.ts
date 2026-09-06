export type EmployeeStatusValue = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface EmployeeLifecycleIdentity {
    status: EmployeeStatusValue;
    deletedAt: Date | null;
}

export type EmployeeLifecycleOperation = "OFFBOARD" | "SUSPEND" | "REACTIVATE";

export function hasEligibleEmployeeLifecycle(
    employee: EmployeeLifecycleIdentity | null,
): boolean {
    return employee === null
        || (employee.status === "ACTIVE" && employee.deletedAt === null);
}

export function employeeLifecycleNeedsWrite(
    operation: EmployeeLifecycleOperation,
    employee: EmployeeLifecycleIdentity,
    account: { isActive: boolean; deletedAt: Date | null } | null,
): boolean {
    if (operation === "OFFBOARD") {
        return employee.status !== "INACTIVE"
            || employee.deletedAt === null
            || Boolean(account?.isActive)
            || Boolean(account && account.deletedAt !== null);
    }
    if (operation === "SUSPEND") {
        return employee.status !== "SUSPENDED"
            || employee.deletedAt !== null
            || Boolean(account?.isActive)
            || Boolean(account && account.deletedAt !== null);
    }
    return employee.status !== "ACTIVE"
        || employee.deletedAt !== null
        || Boolean(account && !account.isActive)
        || Boolean(account && account.deletedAt !== null);
}

export function isEmployeeDeactivation(operation: EmployeeLifecycleOperation): boolean {
    return operation === "OFFBOARD" || operation === "SUSPEND";
}
