import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { hasRequiredAccessClaims } from "@/lib/auth-ssot";
import { getHybridSecretKey } from "@/lib/hybrid-auth-constants";

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AccessTokenClaims {
    sub: string;
    role: string;
    sessionId: string;
    tokenVersion: number;
}

export interface IssueAccessTokenInput {
    userId: number;
    role: string;
    sessionId: string;
    tokenVersion: number;
}

export interface RefreshTokenRecordInput {
    userId: number;
    familyId?: string;
    userAgent?: string;
    ipAddress?: string;
}

export interface RefreshTokenRecordDraft {
    userId: number;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
}

interface VerifiedAccessTokenPayload extends JWTPayload {
    sub: string;
    role: string;
    sid: string;
    ver: number;
}

function getPositiveIntFromEnv(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Environment variable ${name} must be a positive integer`);
    }
    return parsed;
}

export function getAccessTokenTtlSeconds(): number {
    return getPositiveIntFromEnv(
        "AUTH_ACCESS_TOKEN_TTL_SECONDS",
        DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    );
}

export function getRefreshTokenTtlSeconds(): number {
    return getPositiveIntFromEnv(
        "AUTH_REFRESH_TOKEN_TTL_SECONDS",
        DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    );
}

function toAccessTokenClaims(payload: VerifiedAccessTokenPayload): AccessTokenClaims {
    return {
        sub: payload.sub,
        role: payload.role,
        sessionId: payload.sid,
        tokenVersion: payload.ver,
    };
}

function assertAccessPayload(payload: JWTPayload): asserts payload is VerifiedAccessTokenPayload {
    if (!hasRequiredAccessClaims(payload)) {
        throw new Error("Invalid access token payload");
    }
}

export async function issueAccessToken(input: IssueAccessTokenInput): Promise<string> {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = getAccessTokenTtlSeconds();

    return new SignJWT({ role: input.role, sid: input.sessionId, ver: input.tokenVersion })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(String(input.userId))
        .setIssuedAt(nowInSeconds)
        .setExpirationTime(nowInSeconds + ttlSeconds)
        .sign(getHybridSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, getHybridSecretKey(), {
        algorithms: ["HS256"],
    });
    assertAccessPayload(payload);
    return toAccessTokenClaims(payload);
}

export function generateOpaqueRefreshToken(): string {
    return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function buildRefreshTokenRecord(input: RefreshTokenRecordInput): {
    rawToken: string;
    record: RefreshTokenRecordDraft;
} {
    const rawToken = generateOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + getRefreshTokenTtlSeconds() * 1000);

    return {
        rawToken,
        record: {
            userId: input.userId,
            tokenHash: hashRefreshToken(rawToken),
            familyId: input.familyId ?? randomBytes(16).toString("hex"),
            expiresAt,
            userAgent: input.userAgent,
            ipAddress: input.ipAddress,
        },
    };
}
