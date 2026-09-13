import { cookies } from "next/headers";

import { resolveAuthenticatedAccount } from "@/modules/auth";
import {
    buildEmployeeAuthorizationContext,
    findCurrentEmployeeProjection,
    getEmployeePresentationCapabilities,
} from "@/modules/employee";
import {
    buildLeaveAuthorizationContext,
    getCurrentEmployeeLeaveProjection,
    getLeavePresentationCapabilities,
} from "@/modules/leave";
import { getRoutinePresentationCapabilities } from "@/modules/routine";
import {
    buildStockAuthorizationContext,
    getStockPresentationCapabilities,
} from "@/modules/stock";
import {
    buildDepartmentAuthorizationContext,
    getDepartmentPresentationCapabilities,
} from "@/modules/department";
import {
    buildAuditAuthorizationContext,
    getAuditPresentationCapabilities,
} from "@/modules/audit";
import {
    buildNotificationAuthorizationContext,
    getNotificationPresentationCapabilities,
} from "@/modules/notification";
import type { AuthenticatedUser } from "@/modules/auth/client";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { getUserDisplayName } from "@/shared/identity/display";

export type CurrentUserProjection = AuthenticatedUser;

export async function getCurrentUserProjection(): Promise<CurrentUserProjection | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    const account = await resolveAuthenticatedAccount(accessToken);
    if (!account) return null;

    const employee = await findCurrentEmployeeProjection(account.userId);
    if (!employee) return null;

    const employeeAuthorizationContext = buildEmployeeAuthorizationContext(
        {
            id: account.userId,
            role: account.role,
        },
        employee.id,
    );

    const [
        leave,
        leaveCapabilities,
        employeeCapabilities,
        routineCapabilities,
        stockCapabilities,
        departmentCapabilities,
        auditCapabilities,
        notificationCapabilities,
    ] = await Promise.all([
        getCurrentEmployeeLeaveProjection(
            employee.id,
            employee.isManager,
        ),
        getLeavePresentationCapabilities(
            buildLeaveAuthorizationContext(
                {
                    id: account.userId,
                    role: account.role,
                },
                employee.id,
                "DASHBOARD",
            ),
        ),
        getEmployeePresentationCapabilities(employeeAuthorizationContext),
        getRoutinePresentationCapabilities(
            {
                id: account.userId,
                role: account.role,
                email: account.email,
            },
            employee.id,
        ),
        getStockPresentationCapabilities(
            buildStockAuthorizationContext(
                {
                    id: account.userId,
                    role: account.role,
                },
                employee.id,
                "DASHBOARD",
            ),
        ),
        getDepartmentPresentationCapabilities(
            buildDepartmentAuthorizationContext(
                {
                    id: account.userId,
                    role: account.role,
                },
                employee.id,
            ),
        ),
        getAuditPresentationCapabilities(
            buildAuditAuthorizationContext(
                {
                    id: account.userId,
                    role: account.role,
                },
                employee.id,
            ),
        ),
        getNotificationPresentationCapabilities(
            buildNotificationAuthorizationContext(
                {
                    id: account.userId,
                    role: account.role,
                },
                employee.id,
            ),
        ),
    ]);

    return {
        id: String(account.userId),
        role: account.role,
        email: account.email,
        name: getUserDisplayName({
            name: account.name,
            email: account.email,
            employee: {
                firstName: employee.firstName,
                lastName: employee.lastName,
                nickname: employee.nickname,
            },
        }),
        department: employee.departmentName ?? undefined,
        isManager: employee.isManager,
        canApproveLeave:
            leaveCapabilities.canReadAssignedApprovals
            && leave.canApproveLeave,
        canViewLeaveReports: leave.canViewLeaveReports,
        leaveCapabilities,
        routineCapabilities,
        stockCapabilities,
        employeeCapabilities,
        departmentCapabilities,
        auditCapabilities,
        notificationCapabilities,
    };
}
