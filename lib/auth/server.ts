import { cookies } from "next/headers";

import type { HybridAuthSession } from "@/lib/auth/types";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { parseUserId } from "@/lib/auth/hybrid/session";
import { hasActiveSessionFamily } from "@/lib/auth/hybrid/session-store";
import { verifyAccessToken } from "@/lib/auth/hybrid/tokens";
import { hasEligibleEmployeeLifecycle } from "@/lib/auth/ssot";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";

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
                    approvals: { select: { id: true }, take: 1 },
                },
            },
        },
    });
}

function toApiAuthSession(user: SessionUser): ApiAuthSession {
    return {
        user: {
            id: String(user.id),
            role: user.role,
            email: user.email,
            name: getEmployeeBackedUserDisplayName(user),
            department: user.employee?.dept?.name,
            isManager: (user.employee?.subordinates?.length ?? 0) > 0,
            canViewLeaveReports:
                (user.employee?.subordinates?.length ?? 0) > 0
                || (user.employee?.approvals?.length ?? 0) > 0,
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
            || !hasEligibleEmployeeLifecycle(user.employee)
            || !hasActiveSession
            || claims.tokenVersion !== user.tokenVersion
        ) {
            return null;
        }

        return toApiAuthSession(user);
    } catch {
        return null;
    }
}
