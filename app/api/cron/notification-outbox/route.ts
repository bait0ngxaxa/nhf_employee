import { NextResponse } from "next/server";

import { verifySharedSecret } from "@/lib/security/shared-secret";
import { processOutbox } from "@/lib/services/outbox/processor";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const OUTBOX_SECRET_HEADER = "x-outbox-secret";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
    const secretCheck = verifySharedSecret(request, {
        envName: "NOTIFICATION_OUTBOX_CRON_SECRET",
        headerName: OUTBOX_SECRET_HEADER,
    });
    if (secretCheck.status === "not_configured") {
        return jsonError(COMMON_API_MESSAGES.outboxWorkerNotConfigured, 503);
    }
    if (secretCheck.status === "invalid") {
        return forbidden();
    }

    try {
        const result = await processOutbox();
        return NextResponse.json({ success: true, ...result });
    } catch {
        return serverError();
    }
}
