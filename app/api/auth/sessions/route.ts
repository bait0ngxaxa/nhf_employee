import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/auth/hybrid/session";
import {
    listAuthSessions,
    resolveAuthenticatedUserId,
    resolveCurrentSessionFamilyId,
} from "@/modules/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
        const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
        const userId = await resolveAuthenticatedUserId(accessToken);
        if (!userId) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
        }

        const currentFamilyId = await resolveCurrentSessionFamilyId({
            accessToken,
            rawRefreshToken: refreshToken,
            userId,
        });
        const items = await listAuthSessions({ userId, currentFamilyId });

        return NextResponse.json({ sessions: items });
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
}
