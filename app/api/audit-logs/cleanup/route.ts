import { NextResponse } from "next/server";

import { auditLogService } from "@/lib/services/audit-log";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const CLEANUP_SECRET_HEADER = "x-cleanup-secret";

function getExpectedSecret(): string | null {
    const expectedSecret = process.env.AUDIT_LOG_CLEANUP_SECRET?.trim();
    return expectedSecret && expectedSecret.length > 0 ? expectedSecret : null;
}

export async function POST(request: Request): Promise<NextResponse> {
    const expectedSecret = getExpectedSecret();
    if (!expectedSecret) {
        return jsonError(COMMON_API_MESSAGES.cleanupNotConfigured, 503);
    }

    const providedSecret = request.headers.get(CLEANUP_SECRET_HEADER);
    if (providedSecret !== expectedSecret) {
        return forbidden();
    }

    try {
        const result = await auditLogService.cleanupExpiredAuditLogs();

        return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount,
            cutoff: result.cutoff.toISOString(),
        });
    } catch {
        return serverError();
    }
}
