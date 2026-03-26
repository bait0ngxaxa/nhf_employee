import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-ssot";
import { withTrustedMutation } from "@/lib/auth-csrf";
import { logAuthEvent } from "@/lib/audit";
import {
    resolveAuthenticatedUserId,
    resolveCurrentSessionFamilyId,
} from "@/lib/hybrid-auth-route";
import { clearHybridAuthCookies } from "@/lib/hybrid-auth-session";
import { prisma } from "@/lib/prisma";

const revokeSessionSchema = z.object({
    sessionId: z.string().min(1).max(64),
});

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const userId = await resolveAuthenticatedUserId(request);
        if (!userId) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
        }

        const body = await request.json();
        const parsed = revokeSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.forbidden }, { status: 400 });
        }

        const tokenRecord = await prisma.authRefreshToken.findFirst({
            where: {
                id: parsed.data.sessionId,
                userId,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: {
                user: {
                    select: { email: true },
                },
            },
        });

        if (!tokenRecord) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.forbidden }, { status: 404 });
        }

        await prisma.authRefreshToken.updateMany({
            where: {
                userId,
                familyId: tokenRecord.familyId,
                revokedAt: null,
            },
            data: { revokedAt: new Date() },
        });

        await logAuthEvent("LOGOUT", userId, tokenRecord.user.email, {
            metadata: {
                method: "hybrid_logout_single_session",
                familyId: tokenRecord.familyId,
            },
        });

        const currentFamilyId = await resolveCurrentSessionFamilyId(request, userId);
        const response = NextResponse.json({ success: true });
        if (currentFamilyId === tokenRecord.familyId) {
            clearHybridAuthCookies(response);
        }

        return response;
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
});
