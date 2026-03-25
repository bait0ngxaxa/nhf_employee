import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { sendEmail } from "@/lib/email";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AUTH_FORGOT_PASSWORD_MESSAGES } from "@/lib/auth-ssot";

const MAX_REQUESTS_PER_HOUR = 3;
const TOKEN_EXPIRY_HOURS = 1;

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

        if (await isRateLimited(normalizedEmail)) {
            return acceptedResponse();
        }

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

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        await sendEmail({
            to: user.email,
            subject: AUTH_FORGOT_PASSWORD_MESSAGES.resetSubjectThai,
            html: generatePasswordResetEmailHTML(resetUrl, user.name),
            text: AUTH_FORGOT_PASSWORD_MESSAGES.resetMailTextThai(user.name, resetUrl),
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
