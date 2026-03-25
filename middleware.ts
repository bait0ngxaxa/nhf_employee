import { jwtVerify } from "jose";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { hasRequiredAccessClaims } from "@/lib/auth-ssot";
import { HYBRID_ACCESS_COOKIE_NAME, getHybridSecretKey } from "@/lib/hybrid-auth-constants";

const PUBLIC_ROUTES = new Set([
    "/",
    "/login",
    "/signup",
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

async function hasValidNextAuthSession(request: NextRequest): Promise<boolean> {
    try {
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
        });
        return typeof token?.sub === "string" && token.sub.length > 0;
    } catch {
        return false;
    }
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;
    const isPublicRoute = PUBLIC_ROUTES.has(pathname);

    const hasHybridSession = await hasValidHybridAccessToken(request);
    const isAuthenticated = hasHybridSession || await hasValidNextAuthSession(request);

    if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isPublicRoute && !isAuthenticated) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
