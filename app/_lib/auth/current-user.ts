import { cookies } from "next/headers";

import { resolveAuthenticatedAccount } from "@/modules/auth";
import { findCurrentEmployeeProjection } from "@/modules/employee";
import { getCurrentEmployeeLeaveProjection } from "@/modules/leave";
import { getRoutinePresentationCapabilities } from "@/modules/routine";
import {
    buildStockAuthorizationContext,
    getStockPresentationCapabilities,
} from "@/modules/stock";
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

    const leave = await getCurrentEmployeeLeaveProjection(
        employee.id,
        employee.isManager,
    );
    const routineCapabilities = await getRoutinePresentationCapabilities(
        {
            id: account.userId,
            role: account.role,
            email: account.email,
        },
        employee.id,
    );
    const stockCapabilities = await getStockPresentationCapabilities(
        buildStockAuthorizationContext(
            {
                id: account.userId,
                role: account.role,
            },
            employee.id,
            "DASHBOARD",
        ),
    );

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
        canApproveLeave: leave.canApproveLeave,
        canViewLeaveReports: leave.canViewLeaveReports,
        routineCapabilities,
        stockCapabilities,
    };
}
