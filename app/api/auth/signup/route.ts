import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
    clearAuthIdentityRateLimit,
    isAuthRateLimited,
    recordAuthAttempt,
} from "@/lib/auth/rate-limit";
import { AUTH_SIGNUP_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { getClientMetadata } from "@/lib/auth/hybrid/session";
import { signupSchema } from "@/lib/validations/auth";
import { appendAuditBestEffort } from "@/modules/audit";
import { signupAccount, SignupEligibilityError } from "@/modules/auth";

const SIGNUP_RATE_LIMIT_POLICY = {
    windowMs: 60 * 60 * 1000,
    maxAttemptsPerIdentity: 5,
    maxAttemptsPerIp: 25,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
    );
}

export const POST = withTrustedMutation(
    async (request: NextRequest): Promise<NextResponse> => {
        try {
            const body = await request.json();
            const parsed = signupSchema.safeParse(body);

            if (!parsed.success) {
                return NextResponse.json(
                    {
                        error: AUTH_SIGNUP_MESSAGES.requiredFieldsThai,
                        details: parsed.error.flatten().fieldErrors,
                    },
                    { status: 400 },
                );
            }

            const { email, password } = parsed.data;
            const metadata = getClientMetadata(request);
            const rateLimitInput = {
                scope: "signup",
                identity: email,
                ipAddress: metadata.ipAddress,
            };

            if (isAuthRateLimited(rateLimitInput, SIGNUP_RATE_LIMIT_POLICY)) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.rateLimitedThai },
                    { status: 429 },
                );
            }

            recordAuthAttempt(rateLimitInput, SIGNUP_RATE_LIMIT_POLICY);
            const result = await signupAccount({
                email,
                password,
                employeeNotFoundMessage: AUTH_SIGNUP_MESSAGES.employeeNotFoundThai,
                emailAlreadyUsedMessage: AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai,
            });
            clearAuthIdentityRateLimit(rateLimitInput);

            await appendAuditBestEffort({
                action: "USER_CREATE",
                entityType: "User",
                entityId: result.user.id,
                userId: result.user.id,
                userEmail: result.user.email,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                details: {
                    after: {
                        name: result.user.name,
                        email: result.user.email,
                        role: result.user.role,
                    },
                    metadata: {
                        source: "signup",
                        bootstrapAdmin: result.assignedRole === "ADMIN",
                        employeeName: result.employeeDisplayName,
                    },
                },
            });

            // Session creation is handled on the client side via
            // POST /api/auth/hybrid-login after signup succeeds.
            return NextResponse.json(
                {
                    message: AUTH_SIGNUP_MESSAGES.signupSuccessThai,
                    user: {
                        id: result.user.id,
                        name: result.employeeDisplayName,
                        email: result.user.email,
                        role: result.user.role,
                    },
                },
                { status: 201 },
            );
        } catch (error) {
            if (error instanceof SignupEligibilityError) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 400 },
                );
            }

            if (isUniqueConstraintError(error)) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.accountAlreadyRegisteredThai },
                    { status: 409 },
                );
            }

            console.error("Signup error:", error);
            return NextResponse.json(
                { error: AUTH_SIGNUP_MESSAGES.signupFailedThai },
                { status: 500 },
            );
        }
    },
);
