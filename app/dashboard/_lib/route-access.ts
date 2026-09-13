import { redirect } from "next/navigation";

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { isAdminRole } from "@/lib/ssot/permissions";
import { APP_ROUTES } from "@/lib/ssot/routes";
import type { EmployeePresentationCapabilities } from "@/modules/employee";

export type DashboardEmployeeCapability = keyof Pick<
    EmployeePresentationCapabilities,
    "canCreateEmployees" | "canImportEmployees"
>;

export async function requireDashboardAdmin(): Promise<void> {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    if (!isAdminRole(user.role)) {
        redirect(APP_ROUTES.accessDenied);
    }
}

export async function requireDashboardAuditCapability(): Promise<void> {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    if (user.auditCapabilities?.canReadAuditLogs !== true) {
        redirect(APP_ROUTES.accessDenied);
    }
}

export async function requireDashboardEmployeeCapability(
    capability: DashboardEmployeeCapability,
): Promise<void> {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    if (user.employeeCapabilities?.[capability] !== true) {
        redirect(APP_ROUTES.accessDenied);
    }
}
