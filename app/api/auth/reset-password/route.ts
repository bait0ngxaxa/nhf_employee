import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { logAuthEvent } from "@/lib/server/audit";
import { clearHybridAuthCookies } from "@/lib/auth/hybrid/session";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { resetPasswordSchema } from "@/lib/validations/auth";

const BCRYPT_SALT_ROUNDS = 12;

class ResetTokenClaimError extends Error {
    constructor() {
        super(AUTH_ERROR_MESSAGES.usedResetLinkThai);
        this.name = "ResetTokenClaimError";
    }
}

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const result = resetPasswordSchema.safeParse(body);

        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                {
                    error: AUTH_ERROR_MESSAGES.invalidRequestPayloadThai,
                    details: errors.fieldErrors,
                },
                { status: 400 },
            );
        }

        const { token, password } = result.data;
        const hashedToken = hashToken(token);

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token: hashedToken },
        });

        if (!resetToken) {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.invalidResetLinkThai },
                { status: 400 },
            );
        }

        if (resetToken.used) {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.usedResetLinkThai },
                { status: 400 },
            );
        }

        const now = new Date();
        if (resetToken.expiresAt <= now) {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.expiredResetLinkThai },
                { status: 400 },
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: resetToken.email },
            select: { id: true, email: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.userNotFoundThai },
                { status: 400 },
            );
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        try {
            await runSerializableTransaction(async (tx) => {
                const claim = await tx.passwordResetToken.updateMany({
                    where: {
                        id: resetToken.id,
                        used: false,
                        expiresAt: { gt: now },
                    },
                    data: { used: true },
                });

                if (claim.count !== 1) {
                    throw new ResetTokenClaimError();
                }

                await tx.user.update({
                    where: { id: user.id },
                    data: {
                        password: hashedPassword,
                        tokenVersion: { increment: 1 },
                    },
                });
                await tx.authRefreshToken.updateMany({
                    where: { userId: user.id, revokedAt: null },
                    data: { revokedAt: now },
                });
            });
        } catch (error) {
            if (error instanceof ResetTokenClaimError) {
                return NextResponse.json(
                    { error: AUTH_ERROR_MESSAGES.usedResetLinkThai },
                    { status: 400 },
                );
            }
            throw error;
        }

        await logAuthEvent("PASSWORD_RESET", user.id, user.email, {
            metadata: { method: "email_token", forceLogoutAllSessions: true },
        });

        const response = NextResponse.json({
            success: true,
            message: AUTH_ERROR_MESSAGES.resetPasswordSuccessThai,
        });
        clearHybridAuthCookies(response);
        return response;
    } catch {
        return NextResponse.json(
            { error: AUTH_ERROR_MESSAGES.internalServerError },
            { status: 500 },
        );
    }
}
