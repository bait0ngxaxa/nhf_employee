import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { logAuthEvent } from "@/lib/server/audit";
import { clearHybridAuthCookies } from "@/lib/auth/hybrid/session";
import { resetPassword } from "@/modules/auth";
import { resetPasswordSchema } from "@/lib/validations/auth";

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

        const resetResult = await resetPassword(result.data.token, result.data.password);
        if (resetResult.status === "invalid") {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.invalidResetLinkThai },
                { status: 400 },
            );
        }
        if (resetResult.status === "used") {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.usedResetLinkThai },
                { status: 400 },
            );
        }
        if (resetResult.status === "expired") {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.expiredResetLinkThai },
                { status: 400 },
            );
        }
        if (resetResult.status === "userNotFound") {
            return NextResponse.json(
                { error: AUTH_ERROR_MESSAGES.userNotFoundThai },
                { status: 400 },
            );
        }

        await logAuthEvent("PASSWORD_RESET", resetResult.userId, resetResult.email, {
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
