import { NextResponse } from "next/server";

import { cleanupOrphanedLeaveAttachments } from "@/modules/leave";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const CLEANUP_SECRET_HEADER = "x-cleanup-secret";

function parseDryRun(request: Request): boolean | null {
    const value = new URL(request.url).searchParams.get("dryRun");
    if (value === null || value === "0" || value === "false") {
        return false;
    }
    if (value === "1" || value === "true") {
        return true;
    }
    return null;
}

export async function POST(request: Request): Promise<NextResponse> {
    const expectedSecret = process.env.LEAVE_ATTACHMENT_CLEANUP_SECRET?.trim();
    if (!expectedSecret) {
        return jsonError(COMMON_API_MESSAGES.cleanupNotConfigured, 503);
    }

    if (request.headers.get(CLEANUP_SECRET_HEADER) !== expectedSecret) {
        return forbidden();
    }

    const dryRun = parseDryRun(request);
    if (dryRun === null) {
        return jsonError(COMMON_API_MESSAGES.invalidInput, 400);
    }

    try {
        const result = await cleanupOrphanedLeaveAttachments({
            dryRun,
        });

        return NextResponse.json({
            success: true,
            scannedCount: result.scannedCount,
            orphanCount: result.orphanCount,
            deletedCount: result.deletedCount,
            failedCount: result.failedCount,
            skippedRecentCount: result.skippedRecentCount,
            dryRun: result.dryRun,
            cutoff: result.cutoff.toISOString(),
        });
    } catch {
        return serverError();
    }
}
