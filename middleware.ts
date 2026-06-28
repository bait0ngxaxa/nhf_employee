import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

import { hasRequiredAccessClaims } from "@/lib/auth-ssot";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
    getHybridSecretKey,
} from "@/lib/hybrid-auth-constants";
import { buildPublicUrl } from "@/lib/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";

const PUBLIC_ROUTES = new Set([
    "/",
    "/login",
    "/signup",
    "/auth/refresh",
    "/access-denied",
    "/forgot-password",
    "/reset-password",
    "/leave/action",
]);

async function hasValidHybridAccessToken(request: NextRequest): Promise<boolean> {
    const token = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    if (!token) {
        return false;
    }

    try {
        const { payload } = await jwtVerify(token, getHybridSecretKey(), {
            algorithms: ["HS256"],
        });
        return hasRequiredAccessClaims(payload);
    } catch {
        return false;
    }
}

function buildRefreshSessionUrl(request: NextRequest): URL {
    const refreshUrl = buildPublicUrl(APP_ROUTES.refreshSession, request);
    refreshUrl.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return refreshUrl;
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;
    const isPublicRoute = PUBLIC_ROUTES.has(pathname);

    const isAuthenticated = await hasValidHybridAccessToken(request);
    const hasRefreshToken = Boolean(request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value);

    if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
        return NextResponse.redirect(buildPublicUrl("/dashboard", request));
    }

    if (!isPublicRoute && !isAuthenticated) {
        if (hasRefreshToken) {
            return NextResponse.redirect(buildRefreshSessionUrl(request));
        }
        return NextResponse.redirect(buildPublicUrl("/login", request));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
