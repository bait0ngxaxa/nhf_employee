import { cookies } from "next/headers";

import type { HybridAuthSession } from "@/lib/auth-user";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/hybrid-auth-constants";
import { parseUserId } from "@/lib/hybrid-auth-session";
import { verifyAccessToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

export type ApiAuthSession = HybridAuthSession;

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
