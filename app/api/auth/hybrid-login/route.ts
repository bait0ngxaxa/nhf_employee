import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { isAuthRateLimited, recordAuthAttempt } from "@/lib/auth/rate-limit";
import { setHybridAuthCookies, getClientMetadata } from "@/lib/auth/hybrid/session";
import { enforcePreAuthIpRateLimit } from "@/lib/security/mutation-rate-limit";
import { appendAuditBestEffort } from "@/modules/audit";
import { authenticateHybridLogin } from "@/modules/auth";

const hybridLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const LOGIN_RATE_LIMIT_POLICY = {
    windowMs: 15 * 60 * 1000,
    maxAttemptsPerIdentity: 8,
    maxAttemptsPerIp: 40,
} as const;

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const rateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "auth-login",
        );
        if (rateLimitResponse) return rateLimitResponse;

        const body = await request.json();
        const parsed = hybridLoginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.invalidCredentialsPayload }, { status: 400 });
        }

        const normalizedEmail = parsed.data.email.trim().toLowerCase();
        const metadata = getClientMetadata(request);
        const rateLimitInput = {
            scope: "login",
            identity: normalizedEmail,
            ipAddress: metadata.ipAddress,
        };

        if (isAuthRateLimited(rateLimitInput, LOGIN_RATE_LIMIT_POLICY)) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 429 });
        }

        const result = await authenticateHybridLogin({
            email: normalizedEmail,
            password: parsed.data.password,
            metadata,
        });

        if (result.status === "invalidCredentials") {
            recordAuthAttempt(rateLimitInput, LOGIN_RATE_LIMIT_POLICY);
            await appendAuditBestEffort({
                action: "LOGIN_FAILED",
                entityType: "User",
                entityId: result.userId,
                userId: result.userId,
                userEmail: normalizedEmail,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                details: {
                    metadata: {
                        method: "hybrid_login",
                        reason: "invalid_credentials_or_inactive",
                    },
                },
            });
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.invalidEmailOrPassword }, { status: 401 });
        }

        await appendAuditBestEffort({
            action: "LOGIN_SUCCESS",
            entityType: "User",
            entityId: result.user.id,
            userId: result.user.id,
            userEmail: result.user.email,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            details: { metadata: { method: "hybrid_login" } },
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: String(result.user.id),
                email: result.user.email,
                name: result.user.name,
                role: result.user.role,
            },
        });
        setHybridAuthCookies(response, result.accessToken, result.rawRefreshToken);
        return response;
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
});
