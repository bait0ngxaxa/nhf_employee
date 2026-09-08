import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
    getClientMetadata,
} from "@/lib/auth/hybrid/session";
import {
    resolveAuthenticatedUserId,
    resolveCurrentSessionFamilyId,
    revokeAuthSessionFamily,
} from "@/modules/auth";
import { appendAuditBestEffort } from "@/modules/audit";

const revokeSessionSchema = z.object({
    sessionId: z.string().min(1).max(64),
});

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
        const userId = await resolveAuthenticatedUserId(accessToken);
        if (!userId) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
        }

        const body = await request.json();
        const parsed = revokeSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.forbidden }, { status: 400 });
        }

        const tokenRecord = await revokeAuthSessionFamily({
            userId,
            sessionId: parsed.data.sessionId,
        });
        if (!tokenRecord) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.forbidden }, { status: 404 });
        }

        const metadata = getClientMetadata(request);
        await appendAuditBestEffort({
            action: "LOGOUT",
            entityType: "User",
            entityId: userId,
            userId,
            userEmail: tokenRecord.email,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            details: {
                metadata: {
                    method: "hybrid_logout_single_session",
                    familyId: tokenRecord.familyId,
                },
            },
        });

        const currentFamilyId = await resolveCurrentSessionFamilyId({
            accessToken,
            rawRefreshToken: request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value,
            userId,
        });
        const response = NextResponse.json({ success: true });
        if (currentFamilyId === tokenRecord.familyId) {
            clearHybridAuthCookies(response);
        }

        return response;
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
});
