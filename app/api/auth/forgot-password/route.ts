import { withTrustedMutation } from "@/lib/auth/csrf";
import { NOTIFICATION_MODULES } from "@/shared/notifications/presentation";
import { after, type NextRequest, NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";
import { reserveAuthAttempt } from "@/lib/auth/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AUTH_FORGOT_PASSWORD_MESSAGES } from "@/lib/auth/ssot";
import { getClientMetadata } from "@/lib/auth/hybrid/session";
import { buildConfiguredPublicUrl } from "@/lib/network/public-url";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { AUTH_CREDENTIALS_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";
import { requestPasswordReset } from "@/modules/auth";

const MAX_REQUESTS_PER_HOUR = 3;
const FORGOT_PASSWORD_RATE_LIMIT_POLICY = {
    windowMs: 60 * 60 * 1000,
    maxAttemptsPerIdentity: MAX_REQUESTS_PER_HOUR,
    maxAttemptsPerIp: 30,
} as const;

function errorTypeOf(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
}

/**
 * Logs only non-identifying context: never the token, the reset URL or the
 * recipient address.
 */
function schedulePasswordResetEmail(input: {
    readonly to: string;
    readonly name: string;
    readonly resetUrl: string;
}): void {
    after(async () => {
        try {
            const sent = await sendEmail({
                to: input.to,
                subject: AUTH_FORGOT_PASSWORD_MESSAGES.resetSubjectThai,
                fromName: NOTIFICATION_MODULES.Account.sender,
                html: generatePasswordResetEmailHTML(input.resetUrl, input.name),
                text: AUTH_FORGOT_PASSWORD_MESSAGES.resetMailTextThai(
                    input.name,
                    input.resetUrl,
                ),
            });
            if (!sent) {
                console.error("Password reset email delivery failed", {
                    code: "EMAIL_NOT_SENT",
                });
            }
        } catch (error) {
            console.error("Password reset email delivery failed", {
                code: "EMAIL_DELIVERY_ERROR",
                errorType: errorTypeOf(error),
            });
        }
    });
}

function acceptedResponse(): NextResponse {
    return NextResponse.json({
        success: true,
        message: AUTH_FORGOT_PASSWORD_MESSAGES.requestAcceptedThai,
    });
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const bodyResult = await readRouteJsonBody(request, {
            maxBytes: AUTH_CREDENTIALS_MAX_REQUEST_BYTES,
            // Pre-existing contract: malformed JSON fell through to the 500 catch.
            invalidJson: () => NextResponse.json(
                { error: AUTH_FORGOT_PASSWORD_MESSAGES.requestFailedThai },
                { status: 500 },
            ),
        });
        if (!bodyResult.ok) return bodyResult.response;

        const result = forgotPasswordSchema.safeParse(bodyResult.body);
        if (!result.success) {
            return acceptedResponse();
        }

        // Resolve the reset-link origin BEFORE any token work. If production is
        // misconfigured, requestPasswordReset would otherwise delete the user's
        // still-valid unused tokens and consume quota for a link never sent.
        // Production reset links come ONLY from the configured public origin;
        // never from Host / X-Forwarded-Host (reset-link poisoning).
        const resetUrl = buildConfiguredPublicUrl("/reset-password", request);
        if (!resetUrl) {
            console.error("Password reset email not sent: public origin is not configured", {
                code: "PUBLIC_ORIGIN_UNCONFIGURED",
                setting: "PUBLIC_APPROVE_URL",
            });
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

        const authReservation = reserveAuthAttempt(
            rateLimitInput,
            FORGOT_PASSWORD_RATE_LIMIT_POLICY,
        );
        if (!authReservation) {
            return acceptedResponse();
        }

        let resetRequest: Awaited<ReturnType<typeof requestPasswordReset>>;
        try {
            resetRequest = await requestPasswordReset(normalizedEmail);
        } catch (error) {
            authReservation.release();
            throw error;
        }

        if (resetRequest.rateLimited) {
            authReservation.release();
            return acceptedResponse();
        }

        authReservation.commit();
        if (!resetRequest.rawToken || !resetRequest.user) {
            return acceptedResponse();
        }

        resetUrl.searchParams.set("token", resetRequest.rawToken);

        // Delivery runs after the response so response time does not reveal
        // whether the account exists.
        schedulePasswordResetEmail({
            to: resetRequest.user.email,
            name: resetRequest.user.name,
            resetUrl: resetUrl.toString(),
        });

        return acceptedResponse();
    } catch (error) {
        console.error("Error in forgot-password:", error);
        return NextResponse.json(
            { error: AUTH_FORGOT_PASSWORD_MESSAGES.requestFailedThai },
            { status: 500 },
        );
    }
});
