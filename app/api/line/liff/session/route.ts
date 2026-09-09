import { type NextRequest, NextResponse } from "next/server";

import { withTrustedMutation } from "@/lib/auth/csrf";
import {
    findLineAccountLinkByLineUserId,
    lineRequestSizeGuard,
    readLineIdToken,
    clearLiffSessionCookie,
    findActiveLiffWorkforceIdentity,
    issueLiffSession,
    setLiffSessionCookie,
    verifyLineIdToken,
    LineIdentityVerificationError,
} from "@/modules/line";
import { forbidden, operationFailed, serverError, unauthorized } from "@/lib/ssot/http";

function lineVerificationErrorResponse(
    error: unknown,
): NextResponse | null {
    if (!(error instanceof LineIdentityVerificationError)) {
        return null;
    }
    if (error.code === "INVALID_TOKEN") {
        return unauthorized();
    }
    if (error.code === "UPSTREAM_ERROR") {
        return operationFailed(502);
    }
    return serverError();
}

async function handleLiffSession(request: NextRequest): Promise<NextResponse> {
    const requestSizeResponse = lineRequestSizeGuard(request);
    if (requestSizeResponse) {
        return requestSizeResponse;
    }

    const body = await readLineIdToken(request);
    if (!body.ok) {
        return body.response;
    }

    try {
        const lineIdentity = await verifyLineIdToken(body.idToken);
        const link = await findLineAccountLinkByLineUserId(
            lineIdentity.lineUserId,
        );

        if (!link) {
            const response = NextResponse.json({ linked: false });
            clearLiffSessionCookie(response);
            return response;
        }

        const identity = await findActiveLiffWorkforceIdentity(link.userId);
        if (!identity) {
            const response = forbidden();
            clearLiffSessionCookie(response);
            return response;
        }

        const liffSession = await issueLiffSession({
            userId: identity.user.id,
            employeeId: identity.employeeId,
            lineUserId: lineIdentity.lineUserId,
        });
        const response = NextResponse.json({
            linked: true,
            workforce: {
                userId: identity.user.id,
                employeeId: identity.employeeId,
                name: identity.user.name,
            },
        });
        setLiffSessionCookie(response, liffSession);
        return response;
    } catch (error) {
        const lineErrorResponse = lineVerificationErrorResponse(error);
        if (lineErrorResponse) {
            return lineErrorResponse;
        }

        console.error("LINE LIFF session creation failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}

export const POST = withTrustedMutation(handleLiffSession);
