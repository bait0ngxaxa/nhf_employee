import { jwtVerify, type JWTPayload } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const HYBRID_ACCESS_COOKIE_NAME = "nhf_at";
const PUBLIC_ROUTES = new Set([
    "/",
    "/login",
    "/signup",
    "/access-denied",
    "/forgot-password",
    "/reset-password",
    "/leave/action",
]);

function getHybridSecretKey(): Uint8Array | null {
    const secret =
        process.env.AUTH_ACCESS_TOKEN_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim();
    if (!secret) {
        return null;
    }
    return new TextEncoder().encode(secret);
}

function hasRequiredClaims(payload: JWTPayload): boolean {
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        return false;
    }
    if (typeof payload.role !== "string" || payload.role.length === 0) {
        return false;
    }
    if (typeof payload.sid !== "string" || payload.sid.length === 0) {
        return false;
    }
    if (typeof payload.ver !== "number" || !Number.isInteger(payload.ver)) {
        return false;
    }
    return true;
}

async function hasValidHybridAccessToken(request: NextRequest): Promise<boolean> {
    const token = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    const secretKey = getHybridSecretKey();
    if (!token || !secretKey) {
        return false;
    }

    try {
        const { payload } = await jwtVerify(token, secretKey, {
            algorithms: ["HS256"],
        });
        return hasRequiredClaims(payload);
    } catch {
        return false;
    }
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;
    const isPublicRoute = PUBLIC_ROUTES.has(pathname);

    const hasHybridSession = await hasValidHybridAccessToken(request);
    const isAuthenticated = hasHybridSession;

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
