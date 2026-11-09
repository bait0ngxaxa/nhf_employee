import { NextResponse } from "next/server";

import { cleanupOrphanedITTicketAttachments } from "@/modules/it";
import { verifySharedSecret } from "@/lib/security/shared-secret";
import { forbidden, jsonError, operationFailed } from "@/lib/ssot/http";

const CLEANUP_SECRET_HEADER = "x-cleanup-secret";

function parseDryRun(request: Request): boolean | null {
    const parameters = new URL(request.url).searchParams;
    if ([...parameters.keys()].some((key) => key !== "dryRun")) return null;
    const values = parameters.getAll("dryRun");
    if (values.length > 1) return null;
    const value = values[0] ?? null;
    if (value === null || value === "false") return false;
    if (value === "true") return true;
    return null;
}

export async function POST(request: Request): Promise<NextResponse> {
    const secretCheck = verifySharedSecret(request, {
        envName: "IT_ATTACHMENT_CLEANUP_SECRET",
        headerName: CLEANUP_SECRET_HEADER,
    });
    if (secretCheck.status === "not_configured") {
        return jsonError("ยังไม่ได้กำหนดค่าการบำรุงรักษาไฟล์แนบ", 503);
    }
    if (secretCheck.status === "invalid") {
        return forbidden();
    }

    const dryRun = parseDryRun(request);
    if (dryRun === null) {
        return jsonError("ค่า dryRun ไม่ถูกต้อง", 400);
    }

    try {
        const result = await cleanupOrphanedITTicketAttachments({ dryRun });
        return NextResponse.json({ success: true, ...result }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) {
        const rawErrorType = error instanceof Error ? error.name : "UnknownError";
        const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(rawErrorType)
            ? rawErrorType
            : "UnknownError";
        console.error("IT attachment orphan cleanup failed", {
            errorType,
        });
        return operationFailed(500);
    }
}
