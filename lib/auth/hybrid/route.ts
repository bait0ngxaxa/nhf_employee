import { type NextRequest } from "next/server";

import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
    parseUserId,
} from "@/lib/auth/hybrid/session";
import {
    resolveAuthenticatedUserId as resolveAuthUserId,
    resolveCurrentSessionFamilyId as resolveAuthSessionFamilyId,
} from "@/modules/auth";

export async function resolveAuthenticatedUserId(request: NextRequest): Promise<number | null> {
    const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    return resolveAuthUserId(accessToken);
}

export async function resolveCurrentSessionFamilyId(
    request: NextRequest,
    userId: number,
): Promise<string | null> {
    const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
    return resolveAuthSessionFamilyId({
        accessToken,
        rawRefreshToken: refreshToken,
        userId,
    });
}

export { parseUserId };
