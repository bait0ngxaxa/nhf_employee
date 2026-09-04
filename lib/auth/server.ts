import { cookies } from "next/headers";

import type { HybridAuthSession } from "@/lib/auth/types";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { parseUserId } from "@/lib/auth/hybrid/session";
import { hasActiveSessionFamily } from "@/lib/auth/hybrid/session-store";
import { verifyAccessToken } from "@/lib/auth/hybrid/tokens";
import { hasEligibleEmployeeLifecycle } from "@/lib/auth/ssot";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import {
    getActionableLeaveApprovalWhere,
    getApproverHistoryReportWhere,
} from "@/modules/leave";

export type ApiAuthSession = HybridAuthSession;

type SessionUser = NonNullable<Awaited<ReturnType<typeof findActiveUser>>>;

async function findActiveUser(userId: number) {
    return prisma.user.findUnique({
        where: { id: userId, isActive: true, deletedAt: null },
        include: {
            employee: {
                include: {
                    dept: { select: { name: true } },
                    subordinates: { select: { id: true }, take: 1 },
                    approvals: {
                        where: {
                            exceptionApproverId: null,
                            ...getActionableLeaveApprovalWhere(),
                        },
                        select: { id: true },
                        take: 1,
                    },
                    exceptionApprovals: {
                        where: getActionableLeaveApprovalWhere(),
                        select: { id: true },
                        take: 1,
                    },
                },
            },
        },
    });
}

async function hasLeaveApprovalReportHistory(employeeId: number): Promise<boolean> {
    const approval = await prisma.leaveRequest.findFirst({
        where: getApproverHistoryReportWhere(employeeId),
        select: { id: true },
    });

    return approval !== null;
}

function toApiAuthSession(
    user: SessionUser,
    hasApprovalReportHistory: boolean,
): ApiAuthSession {
    return {
        user: {
            id: String(user.id),
            role: user.role,
            email: user.email,
            name: getEmployeeBackedUserDisplayName(user),
            department: user.employee?.dept?.name,
            isManager: (user.employee?.subordinates?.length ?? 0) > 0,
            canApproveLeave:
                (user.employee?.subordinates?.length ?? 0) > 0
                || (user.employee?.approvals?.length ?? 0) > 0
                || (user.employee?.exceptionApprovals?.length ?? 0) > 0,
            canViewLeaveReports:
                (user.employee?.subordinates?.length ?? 0) > 0
                || hasApprovalReportHistory,
        },
    };
}

export async function getApiAuthSession(): Promise<ApiAuthSession | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(HYBRID_ACCESS_COOKIE_NAME)?.value;

    if (!accessToken) {
        return null;
    }

    try {
        const claims = await verifyAccessToken(accessToken);
        const userId = parseUserId(claims.sub);
        if (!userId) {
            return null;
        }

        const [user, hasActiveSession] = await Promise.all([
            findActiveUser(userId),
            hasActiveSessionFamily(userId, claims.sessionId),
        ]);

        if (
            !user
            || !user.employee
            || !hasEligibleEmployeeLifecycle(user.employee)
            || !hasActiveSession
            || claims.tokenVersion !== user.tokenVersion
        ) {
            return null;
        }

        const hasApprovalReportHistory = await hasLeaveApprovalReportHistory(user.employee.id);
        return toApiAuthSession(user, hasApprovalReportHistory);
    } catch {
        return null;
    }
}
