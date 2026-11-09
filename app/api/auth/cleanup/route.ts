import { NextResponse } from "next/server";

import { verifySharedSecret } from "@/lib/security/shared-secret";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { cleanupAuthRefreshSessions } from "@/modules/auth";

const CLEANUP_SECRET_HEADER = "x-cleanup-secret";

export async function POST(request: Request): Promise<NextResponse> {
    const secretCheck = verifySharedSecret(request, {
        envName: "AUTH_CLEANUP_SECRET",
        headerName: CLEANUP_SECRET_HEADER,
    });
    if (secretCheck.status === "not_configured") {
        return jsonError(COMMON_API_MESSAGES.cleanupNotConfigured, 503);
    }
    if (secretCheck.status === "invalid") {
        return forbidden();
    }

    try {
        const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const deletedCount = await cleanupAuthRefreshSessions(retentionCutoff);

        return NextResponse.json({ success: true, deletedCount });
    } catch {
        return serverError();
    }
}
