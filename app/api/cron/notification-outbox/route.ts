import { NextResponse } from "next/server";

import { processOutbox } from "@/lib/services/outbox/processor";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const OUTBOX_SECRET_HEADER = "x-outbox-secret";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getExpectedSecret(): string | null {
    const secret = process.env.NOTIFICATION_OUTBOX_CRON_SECRET?.trim();
    return secret && secret.length > 0 ? secret : null;
}

export async function POST(request: Request): Promise<NextResponse> {
    const expectedSecret = getExpectedSecret();
    if (!expectedSecret) {
        return jsonError(COMMON_API_MESSAGES.outboxWorkerNotConfigured, 503);
    }

    if (request.headers.get(OUTBOX_SECRET_HEADER) !== expectedSecret) {
        return forbidden();
    }

    try {
        const result = await processOutbox();
        return NextResponse.json({ success: true, ...result });
    } catch {
        return serverError();
    }
}
