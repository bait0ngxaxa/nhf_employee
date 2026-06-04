import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { sendEmail } from "@/lib/email";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";
import { isAuthRateLimited, recordAuthAttempt } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AUTH_FORGOT_PASSWORD_MESSAGES } from "@/lib/auth-ssot";
import { getClientMetadata } from "@/lib/hybrid-auth-session";
import { buildPublicUrl } from "@/lib/public-url";

const MAX_REQUESTS_PER_HOUR = 3;
const TOKEN_EXPIRY_HOURS = 1;
const FORGOT_PASSWORD_RATE_LIMIT_POLICY = {
    windowMs: 60 * 60 * 1000,
    maxAttemptsPerIdentity: MAX_REQUESTS_PER_HOUR,
    maxAttemptsPerIp: 30,
} as const;

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function isRateLimited(email: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRequests = await prisma.passwordResetToken.count({
        where: {
            email,
            createdAt: { gte: oneHourAgo },
        },
    });

    return recentRequests >= MAX_REQUESTS_PER_HOUR;
}

function acceptedResponse(): NextResponse {
    return NextResponse.json({
        success: true,
        message: AUTH_FORGOT_PASSWORD_MESSAGES.requestAcceptedThai,
    });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();

        const result = forgotPasswordSchema.safeParse(body);
        if (!result.success) {
            return acceptedResponse();
        }

        const { email } = result.data;
        const normalizedEmail = email.toLowerCase().trim();
        const metadata = getClientMetadata(request);
        const rateLimitInput = {
            scope: "forgot-password",
            identity: normalizedEmail,
            ipAddress: metadata.ipAddress,
        };

        if (
            isAuthRateLimited(rateLimitInput, FORGOT_PASSWORD_RATE_LIMIT_POLICY) ||
            await isRateLimited(normalizedEmail)
        ) {
            return acceptedResponse();
        }

        recordAuthAttempt(rateLimitInput, FORGOT_PASSWORD_RATE_LIMIT_POLICY);

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, name: true, email: true, isActive: true },
        });

        if (!user || !user.isActive) {
            return acceptedResponse();
        }

        await prisma.passwordResetToken.deleteMany({
            where: {
                email: normalizedEmail,
                used: false,
            },
        });

        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await prisma.passwordResetToken.create({
            data: {
                token: hashedToken,
                email: normalizedEmail,
                expiresAt,
            },
        });

        const resetUrl = buildPublicUrl("/reset-password", request);
        resetUrl.searchParams.set("token", rawToken);

        await sendEmail({
            to: user.email,
            subject: AUTH_FORGOT_PASSWORD_MESSAGES.resetSubjectThai,
            html: generatePasswordResetEmailHTML(resetUrl.toString(), user.name),
            text: AUTH_FORGOT_PASSWORD_MESSAGES.resetMailTextThai(user.name, resetUrl.toString()),
        });

        return acceptedResponse();
    } catch (error) {
        console.error("Error in forgot-password:", error);
        return NextResponse.json(
            { error: AUTH_FORGOT_PASSWORD_MESSAGES.requestFailedThai },
            { status: 500 },
        );
    }
}
