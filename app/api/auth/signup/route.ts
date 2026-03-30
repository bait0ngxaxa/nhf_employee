import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createAuditLog, logAuthEvent } from "@/lib/audit";
import {
    clearSignupRateLimit,
    isSignupRateLimited,
    recordSignupAttempt,
} from "@/lib/auth-signup-rate-limit";
import { AUTH_SIGNUP_MESSAGES } from "@/lib/auth-ssot";
import { withTrustedMutation } from "@/lib/auth-csrf";
import {
    getClientMetadata,
    setHybridAuthCookies,
} from "@/lib/hybrid-auth-session";
import {
    buildRefreshTokenRecord,
    issueAccessToken,
} from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";
import { isBootstrapAdminEmail } from "@/lib/ssot/admin-bootstrap";
import { signupSchema } from "@/lib/validations/auth";

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
            const { ipAddress } = metadata;

            if (isSignupRateLimited(email, ipAddress)) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.rateLimitedThai },
                    { status: 429 },
                );
            }

            recordSignupAttempt(email, ipAddress);

            const existingUser = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai },
                    { status: 400 },
                );
            }

            const matchedEmployee = await prisma.employee.findUnique({
                where: { email },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    user: { select: { id: true } },
                },
            });

            if (!matchedEmployee) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.employeeNotFoundThai },
                    { status: 400 },
                );
            }

            if (matchedEmployee.user) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai },
                    { status: 400 },
                );
            }

            const hashedPassword = await bcrypt.hash(password, 12);
            const employeeName = `${matchedEmployee.firstName} ${matchedEmployee.lastName}`;
            const assignedRole = isBootstrapAdminEmail(email) ? "ADMIN" : "USER";

            const user = await prisma.user.create({
                data: {
                    name: employeeName,
                    email,
                    password: hashedPassword,
                    role: assignedRole,
                    isActive: true,
                    employeeId: matchedEmployee.id,
                },
            });

            const refreshDraft = buildRefreshTokenRecord({
                userId: user.id,
                userAgent: metadata.userAgent,
                ipAddress: metadata.ipAddress,
            });
            const accessToken = await issueAccessToken({
                userId: user.id,
                role: user.role,
                sessionId: refreshDraft.record.familyId,
                tokenVersion: user.tokenVersion ?? 1,
            });

            await prisma.authRefreshToken.create({
                data: {
                    userId: refreshDraft.record.userId,
                    tokenHash: refreshDraft.record.tokenHash,
                    familyId: refreshDraft.record.familyId,
                    expiresAt: refreshDraft.record.expiresAt,
                    userAgent: refreshDraft.record.userAgent,
                    ipAddress: refreshDraft.record.ipAddress,
                },
            });

            clearSignupRateLimit(email, ipAddress);

            await createAuditLog({
                action: "USER_CREATE",
                entityType: "User",
                entityId: user.id,
                userId: user.id,
                userEmail: user.email,
                details: {
                    after: {
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    },
                    metadata: {
                        source: "signup",
                        bootstrapAdmin: assignedRole === "ADMIN",
                    },
                },
            });
            await logAuthEvent("LOGIN_SUCCESS", user.id, user.email, {
                metadata: { method: "signup_auto_login" },
            });

            const response = NextResponse.json(
                {
                    message: AUTH_SIGNUP_MESSAGES.signupSuccessThai,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    },
                },
                { status: 201 },
            );
            setHybridAuthCookies(response, accessToken, refreshDraft.rawToken);
            return response;
        } catch (error) {
            console.error("Signup error:", error);
            return NextResponse.json(
                { error: AUTH_SIGNUP_MESSAGES.signupFailedThai },
                { status: 500 },
            );
        }
    },
);
