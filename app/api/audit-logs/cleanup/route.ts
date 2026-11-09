import { NextResponse } from "next/server";

import { verifySharedSecret } from "@/lib/security/shared-secret";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { cleanupExpiredAuditLogs } from "@/modules/audit";

const CLEANUP_SECRET_HEADER = "x-cleanup-secret";

export async function POST(request: Request): Promise<NextResponse> {
    const secretCheck = verifySharedSecret(request, {
        envName: "AUDIT_LOG_CLEANUP_SECRET",
        headerName: CLEANUP_SECRET_HEADER,
    });
    if (secretCheck.status === "not_configured") {
        return jsonError(COMMON_API_MESSAGES.cleanupNotConfigured, 503);
    }
    if (secretCheck.status === "invalid") {
        return forbidden();
    }

    try {
        const result = await cleanupExpiredAuditLogs();

        return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount,
            cutoff: result.cutoff.toISOString(),
        });
    } catch {
        return serverError();
    }
}
