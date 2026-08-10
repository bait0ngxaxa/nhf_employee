import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { hasPrismaErrorCode } from "@/lib/db/transaction";
import {
    lineRequestSizeGuard,
    readLineIdToken,
} from "@/lib/line/api";
import {
    LineAccountLinkConflictError,
    linkLineAccount,
} from "@/lib/line/account-link";
import { LineIdentityVerificationError } from "@/lib/line/errors";
import {
    issueLiffSession,
    setLiffSessionCookie,
} from "@/lib/line/liff-session";
import { verifyLineIdToken } from "@/lib/line/verify-id-token";
import { jsonError, operationFailed, serverError, unauthorized } from "@/lib/ssot/http";

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

async function handleAccountLink(
    request: NextRequest,
): Promise<NextResponse> {
    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) {
        return auth.response;
    }

    const body = await readLineIdToken(request);
    if (!body.ok) {
        return body.response;
    }

    try {
        const lineIdentity = await verifyLineIdToken(body.idToken);
        await linkLineAccount(auth.user.id, lineIdentity.lineUserId);

        const liffSession = await issueLiffSession({
            userId: auth.user.id,
            employeeId: auth.employeeId,
        });
        const response = NextResponse.json({ linked: true });
        setLiffSessionCookie(response, liffSession);
        return response;
    } catch (error) {
        const lineErrorResponse = lineVerificationErrorResponse(error);
        if (lineErrorResponse) {
            return lineErrorResponse;
        }
        if (
            error instanceof LineAccountLinkConflictError
            || hasPrismaErrorCode(error, "P2002")
        ) {
            return jsonError("LINE account link conflict", 409);
        }

        console.error("LINE account linking failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const requestSizeResponse = lineRequestSizeGuard(request);
    if (requestSizeResponse) {
        return requestSizeResponse;
    }

    return withTrustedMutation(handleAccountLink)(request);
}
