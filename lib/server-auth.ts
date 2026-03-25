import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { isValidSessionUser } from "@/lib/auth-ssot";
import { authOptions } from "@/lib/auth";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/hybrid-auth-constants";
import { parseUserId } from "@/lib/hybrid-auth-session";
import { verifyAccessToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

interface ApiSessionUser {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
    department?: string;
    isManager?: boolean;
}

export interface ApiAuthSession {
    user: ApiSessionUser;
}

function toApiAuthSession(session: Session): ApiAuthSession | null {
    if (!isValidSessionUser(session.user)) {
        return null;
    }

    return {
        user: {
            id: session.user.id,
            role: session.user.role,
            email: session.user.email,
            name: session.user.name,
            department: session.user.department,
            isManager: session.user.isManager,
        },
    };
}

async function getHybridFallbackSession(): Promise<ApiAuthSession | null> {
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

        const user = await prisma.user.findUnique({
            where: { id: userId, isActive: true },
            include: {
                employee: {
                    include: {
                        dept: { select: { name: true } },
                        subordinates: { select: { id: true }, take: 1 },
                    },
                },
            },
        });

        if (!user || claims.tokenVersion !== user.tokenVersion) {
            return null;
        }

        return {
            user: {
                id: String(user.id),
                role: user.role,
                email: user.email,
                name: user.name,
                department: user.employee?.dept?.name,
                isManager: (user.employee?.subordinates?.length ?? 0) > 0,
            },
        };
    } catch {
        return null;
    }
}

export async function getApiAuthSession(): Promise<ApiAuthSession | null> {
    const session = await getServerSession(authOptions);
    const baseSession = session ? toApiAuthSession(session) : null;
    if (baseSession) {
        return baseSession;
    }

    return getHybridFallbackSession();
}
