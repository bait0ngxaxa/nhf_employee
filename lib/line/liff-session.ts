import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { NextResponse } from "next/server";

import { getLineLiffSessionConfig } from "./config";
import { LineIdentityVerificationError } from "./errors";

export const LIFF_SESSION_COOKIE_NAME = "nhf_liff_session";
export const LIFF_SESSION_PURPOSE = "nhf-liff";

const LIFF_SESSION_ISSUER = "nhf_employee";
const LIFF_SESSION_AUDIENCE = LIFF_SESSION_PURPOSE;

export interface LiffSessionClaims {
    userId: number;
    employeeId: number;
}

interface VerifiedLiffSessionPayload extends JWTPayload {
    sub: string;
    employeeId: number;
    purpose: typeof LIFF_SESSION_PURPOSE;
}

function getSessionKey(secret: string): Uint8Array {
    return new TextEncoder().encode(secret);
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value > 0;
}

function parsePositiveIntegerClaim(value: unknown): number | null {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function assertIssueInput(input: LiffSessionClaims): void {
    if (!isPositiveInteger(input.userId) || !isPositiveInteger(input.employeeId)) {
        throw new Error("Invalid LIFF session identity");
    }
}

function isVerifiedLiffSessionPayload(
    payload: JWTPayload,
): payload is VerifiedLiffSessionPayload {
    const userId = parsePositiveIntegerClaim(payload.sub);
    return (
        userId !== null
        && isPositiveInteger(payload.employeeId)
        && payload.purpose === LIFF_SESSION_PURPOSE
        && typeof payload.iat === "number"
        && Number.isInteger(payload.iat)
        && typeof payload.exp === "number"
        && Number.isInteger(payload.exp)
        && payload.exp > Math.floor(Date.now() / 1000)
    );
}

export async function issueLiffSession(
    input: LiffSessionClaims,
): Promise<string> {
    assertIssueInput(input);
    const { secret, ttlSeconds } = getLineLiffSessionConfig();
    const nowInSeconds = Math.floor(Date.now() / 1000);

    return new SignJWT({
        employeeId: input.employeeId,
        purpose: LIFF_SESSION_PURPOSE,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(String(input.userId))
        .setIssuer(LIFF_SESSION_ISSUER)
        .setAudience(LIFF_SESSION_AUDIENCE)
        .setIssuedAt(nowInSeconds)
        .setExpirationTime(nowInSeconds + ttlSeconds)
        .sign(getSessionKey(secret));
}

export async function verifyLiffSession(
    token: string,
): Promise<LiffSessionClaims> {
    const { secret } = getLineLiffSessionConfig();

    try {
        const { payload } = await jwtVerify(token, getSessionKey(secret), {
            algorithms: ["HS256"],
            issuer: LIFF_SESSION_ISSUER,
            audience: LIFF_SESSION_AUDIENCE,
        });

        if (!isVerifiedLiffSessionPayload(payload)) {
            throw new Error("Invalid LIFF session payload");
        }

        const userId = parsePositiveIntegerClaim(payload.sub);
        if (userId === null) {
            throw new Error("Invalid LIFF session user ID");
        }

        return {
            userId,
            employeeId: payload.employeeId,
        };
    } catch (error) {
        if (
            error instanceof LineIdentityVerificationError
            && error.code === "MISCONFIGURED"
        ) {
            throw error;
        }
        throw new Error("Invalid LIFF session");
    }
}

function getLiffSessionCookieOptions(maxAge: number): {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
} {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge,
    };
}

export function setLiffSessionCookie(
    response: NextResponse,
    token: string,
): void {
    const { ttlSeconds } = getLineLiffSessionConfig();
    response.cookies.set(
        LIFF_SESSION_COOKIE_NAME,
        token,
        getLiffSessionCookieOptions(ttlSeconds),
    );
}

export function clearLiffSessionCookie(response: NextResponse): void {
    response.cookies.set(
        LIFF_SESSION_COOKIE_NAME,
        "",
        getLiffSessionCookieOptions(0),
    );
}
