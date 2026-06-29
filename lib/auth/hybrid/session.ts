import { type NextRequest, type NextResponse } from "next/server";

import {
    getAccessTokenTtlSeconds,
    getRefreshTokenTtlSeconds,
} from "@/lib/auth/hybrid/tokens";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/auth/hybrid/constants";
import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";

export { HYBRID_ACCESS_COOKIE_NAME, HYBRID_REFRESH_COOKIE_NAME } from "@/lib/auth/hybrid/constants";

export function getClientMetadata(request: NextRequest): {
    ipAddress?: string;
    userAgent?: string;
} {
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const ipAddress = getTrustedClientIp(request.headers) ?? undefined;

    return { ipAddress, userAgent };
}

function getAccessCookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
} {
    return {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: getAccessTokenTtlSeconds(),
    };
}

function getRefreshCookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
} {
    return {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: getRefreshTokenTtlSeconds(),
    };
}

export function setHybridAuthCookies(
    response: NextResponse,
    accessToken: string,
    refreshToken: string,
): void {
    response.cookies.set(HYBRID_ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
    response.cookies.set(HYBRID_REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
}

export function setHybridAccessCookie(
    response: NextResponse,
    accessToken: string,
): void {
    response.cookies.set(HYBRID_ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
}

export function clearHybridAuthCookies(response: NextResponse): void {
    response.cookies.set(HYBRID_ACCESS_COOKIE_NAME, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    response.cookies.set(HYBRID_REFRESH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
}

export function parseUserId(raw: string | undefined): number | null {
    if (!raw) {
        return null;
    }

    const userId = Number.parseInt(raw, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
        return null;
    }
    return userId;
}
