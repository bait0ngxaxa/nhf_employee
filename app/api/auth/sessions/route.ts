import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-ssot";
import {
    resolveAuthenticatedUserId,
    resolveCurrentSessionFamilyId,
} from "@/lib/hybrid-auth-route";
import { prisma } from "@/lib/prisma";

interface SessionItemResponse {
    id: string;
    familyId: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
    isCurrent: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const userId = await resolveAuthenticatedUserId(request);
        if (!userId) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
        }

        const currentFamilyId = await resolveCurrentSessionFamilyId(request, userId);
        const now = new Date();
        const sessions = await prisma.authRefreshToken.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
            select: {
                id: true,
                familyId: true,
                createdAt: true,
                lastUsedAt: true,
                expiresAt: true,
                userAgent: true,
                ipAddress: true,
            },
        });

        const items: SessionItemResponse[] = sessions.map((session) => ({
            ...session,
            isCurrent: currentFamilyId === session.familyId,
        }));

        return NextResponse.json({ sessions: items });
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
}
