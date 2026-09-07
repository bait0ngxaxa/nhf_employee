import { type NextRequest, NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";
import { isAuthRateLimited, recordAuthAttempt } from "@/lib/auth/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AUTH_FORGOT_PASSWORD_MESSAGES } from "@/lib/auth/ssot";
import { getClientMetadata } from "@/lib/auth/hybrid/session";
import { buildPublicUrl } from "@/lib/network/public-url";
import { requestPasswordReset } from "@/modules/auth";

const MAX_REQUESTS_PER_HOUR = 3;
const FORGOT_PASSWORD_RATE_LIMIT_POLICY = {
    windowMs: 60 * 60 * 1000,
    maxAttemptsPerIdentity: MAX_REQUESTS_PER_HOUR,
    maxAttemptsPerIp: 30,
} as const;

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
            isAuthRateLimited(rateLimitInput, FORGOT_PASSWORD_RATE_LIMIT_POLICY)
        ) {
            return acceptedResponse();
        }

        const resetRequest = await requestPasswordReset(normalizedEmail);
        if (resetRequest.rateLimited) {
            return acceptedResponse();
        }
        recordAuthAttempt(rateLimitInput, FORGOT_PASSWORD_RATE_LIMIT_POLICY);
        if (!resetRequest.rawToken || !resetRequest.user) {
            return acceptedResponse();
        }

        const resetUrl = buildPublicUrl("/reset-password", request);
        resetUrl.searchParams.set("token", resetRequest.rawToken);

        await sendEmail({
            to: resetRequest.user.email,
            subject: AUTH_FORGOT_PASSWORD_MESSAGES.resetSubjectThai,
            html: generatePasswordResetEmailHTML(resetUrl.toString(), resetRequest.user.name),
            text: AUTH_FORGOT_PASSWORD_MESSAGES.resetMailTextThai(
                resetRequest.user.name,
                resetUrl.toString(),
            ),
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
