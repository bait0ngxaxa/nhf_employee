import { redirect } from "next/navigation";

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { APP_ROUTES } from "@/lib/ssot/routes";
import {
    assertAuthorizationAdministrationAccess,
    AuthorizationAdministrationAccessError,
    type AuthorizationAdministrationPrincipal,
} from "@/modules/authorization";
import type { EmployeePresentationCapabilities } from "@/modules/employee";
import type { EmailRequestPresentationCapabilities } from "@/modules/it/client";
import type { ITPresentationCapabilities } from "@/modules/it";
import { canAccessITWorkspaceDashboard } from "@/modules/it";
import {
    canAccessITTicketDashboard,
    canAccessITTicketQueue,
} from "@/constants/dashboard";

export type DashboardEmployeeCapability = keyof Pick<
    EmployeePresentationCapabilities,
    "canCreateEmployees" | "canImportEmployees"
>;

export async function requireDashboardEmailRequestAccess(): Promise<EmailRequestPresentationCapabilities> {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    const capabilities = user.emailRequestCapabilities ?? {
        canReadRequests: false,
        canCreateRequests: false,
    };
    if (!capabilities.canReadRequests && !capabilities.canCreateRequests) {
        redirect(APP_ROUTES.accessDenied);
    }

    return capabilities;
}

export async function requireDashboardITSelfServiceAccess(): Promise<ITPresentationCapabilities> {
    const user = await getCurrentUserProjection();
    if (!user) redirect(APP_ROUTES.login);

    const capabilities = user.itCapabilities ?? {
        canReadOwnTickets: false,
        canReadAllTickets: false,
        canCreateOwnTickets: false,
        canCommentOwnTickets: false,
        canCommentAllTickets: false,
        canManageTickets: false,
        canReadAnalytics: false,
    };
    if (!canAccessITTicketDashboard(capabilities)) {
        redirect(APP_ROUTES.accessDenied);
    }
    return capabilities;
}

export async function requireDashboardITWorkspaceAccess(): Promise<ITPresentationCapabilities> {
    const user = await getCurrentUserProjection();
    if (!user) redirect(APP_ROUTES.login);

    const capabilities = user.itCapabilities ?? {
        canReadOwnTickets: false,
        canReadAllTickets: false,
        canCreateOwnTickets: false,
        canCommentOwnTickets: false,
        canCommentAllTickets: false,
        canManageTickets: false,
        canReadAnalytics: false,
    };
    if (!canAccessITWorkspaceDashboard(capabilities)) {
        redirect(APP_ROUTES.accessDenied);
    }
    return capabilities;
}

export async function requireDashboardITOperatorReadAccess(): Promise<ITPresentationCapabilities> {
    const user = await getCurrentUserProjection();
    if (!user) redirect(APP_ROUTES.login);

    const capabilities = user.itCapabilities ?? {
        canReadOwnTickets: false,
        canReadAllTickets: false,
        canCreateOwnTickets: false,
        canCommentOwnTickets: false,
        canCommentAllTickets: false,
        canManageTickets: false,
        canReadAnalytics: false,
    };
    if (!canAccessITTicketQueue(capabilities)) {
        redirect(APP_ROUTES.accessDenied);
    }
    return capabilities;
}

export async function requireDashboardITAnalyticsAccess(): Promise<void> {
    const user = await getCurrentUserProjection();
    if (!user) redirect(APP_ROUTES.login);
    if (user.itCapabilities?.canReadAnalytics !== true) {
        redirect(APP_ROUTES.accessDenied);
    }
}

export async function requireDashboardITReadAccess(): Promise<ITPresentationCapabilities> {
    const capabilities = await requireDashboardITSelfServiceAccess();
    if (!capabilities.canReadOwnTickets) redirect(APP_ROUTES.accessDenied);
    return capabilities;
}

export async function requireDashboardAuthorizationAdministration(): Promise<
    AuthorizationAdministrationPrincipal
> {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    try {
        return assertAuthorizationAdministrationAccess({
            userId: Number(user.id),
            systemRole: user.role,
        });
    } catch (error) {
        if (error instanceof AuthorizationAdministrationAccessError) {
            redirect(APP_ROUTES.accessDenied);
        }
        throw error;
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
