import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";

import { createAuditLog } from "@/lib/server/audit";
import {
    clearAuthIdentityRateLimit,
    isAuthRateLimited,
    recordAuthAttempt,
} from "@/lib/auth/rate-limit";
import {
    AUTH_SIGNUP_MESSAGES,
} from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { getClientMetadata } from "@/lib/auth/hybrid/session";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    findSignupEmployee,
    getEmployeeDisplayName,
    getEmployeeFullName,
    hasEligibleEmployeeLifecycle,
    lockAndRecheckSignupEmployee,
} from "@/modules/employee";
import { isBootstrapAdminEmail } from "@/lib/ssot/admin-bootstrap";
import { signupSchema } from "@/lib/validations/auth";

const SIGNUP_RATE_LIMIT_POLICY = {
    windowMs: 60 * 60 * 1000,
    maxAttemptsPerIdentity: 5,
    maxAttemptsPerIp: 25,
} as const;

class SignupEligibilityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SignupEligibilityError";
    }
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
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
            const { ipAddress } = metadata;
            const rateLimitInput = {
                scope: "signup",
                identity: email,
                ipAddress,
            };

            if (isAuthRateLimited(rateLimitInput, SIGNUP_RATE_LIMIT_POLICY)) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.rateLimitedThai },
                    { status: 429 },
                );
            }

            recordAuthAttempt(rateLimitInput, SIGNUP_RATE_LIMIT_POLICY);

            const existingUser = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                return NextResponse.json(
                    { error: AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai },
                    { status: 400 },
                );
            }

            const matchedEmployee = await findSignupEmployee(email);

            if (
                !matchedEmployee
                || !hasEligibleEmployeeLifecycle(matchedEmployee)
            ) {
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
            const { user, assignedRole, employeeDisplayName } = await runSerializableTransaction(async (tx) => {
                const lockedEmployee = await lockAndRecheckSignupEmployee(
                    tx,
                    matchedEmployee.id,
                    email,
                );

                if (
                    !lockedEmployee
                ) {
                    throw new SignupEligibilityError(
                        AUTH_SIGNUP_MESSAGES.employeeNotFoundThai,
                    );
                }

                if (lockedEmployee.user) {
                    throw new SignupEligibilityError(
                        AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai,
                    );
                }

                const lockedEmployeeName = getEmployeeFullName(
                    lockedEmployee.firstName,
                    lockedEmployee.lastName,
                );
                const lockedEmployeeRole = isBootstrapAdminEmail(lockedEmployee.email)
                    ? Role.ADMIN
                    : Role.USER;
                const createdUser = await tx.user.create({
                    data: {
                        name: lockedEmployeeName,
                        email: lockedEmployee.email,
                        password: hashedPassword,
                        role: lockedEmployeeRole,
                        isActive: true,
                        employeeId: lockedEmployee.id,
                    },
                });

                return {
                    user: createdUser,
                    assignedRole: lockedEmployeeRole,
                    employeeDisplayName: getEmployeeDisplayName(lockedEmployee),
                };
            });

            clearAuthIdentityRateLimit(rateLimitInput);

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
                        bootstrapAdmin: assignedRole === Role.ADMIN,
                        employeeName: employeeDisplayName,
                    },
                },
            });

            // Session creation is handled on the client side via
            // POST /api/auth/hybrid-login after signup succeeds.
            return NextResponse.json(
                {
                    message: AUTH_SIGNUP_MESSAGES.signupSuccessThai,
                    user: {
                        id: user.id,
                        name: employeeDisplayName,
                        email: user.email,
                        role: user.role,
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

