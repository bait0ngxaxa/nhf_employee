import { NextResponse } from "next/server";

import { verifySharedSecret } from "@/lib/security/shared-secret";
import { isFeatureEnabled, FEATURE_KEYS } from "@/lib/ssot/features";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { ROUTINE_API_MESSAGES } from "@/lib/ssot/messages";
import { runRoutineScheduler, type RoutineSchedulerResult } from "@/modules/routine";

const ROUTINE_SCHEDULER_SECRET_HEADER = "x-routine-secret";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function emptySchedulerResult(): RoutineSchedulerResult {
    return {
        occurrencesCreated: 0,
        remindersConsidered: 0,
        outboxEnqueued: 0,
        duplicatesSkipped: 0,
        inactiveSkipped: 0,
        noRecipientSkipped: 0,
        contractRemindersConsidered: 0,
        contractOutboxEnqueued: 0,
        contractDuplicatesSkipped: 0,
        contractNoRecipientSkipped: 0,
        errors: 0,
    };
}

export async function POST(request: Request): Promise<NextResponse> {
    const secretCheck = verifySharedSecret(request, {
        envName: "ROUTINE_SCHEDULER_CRON_SECRET",
        headerName: ROUTINE_SCHEDULER_SECRET_HEADER,
    });
    if (secretCheck.status === "not_configured") {
        return jsonError(ROUTINE_API_MESSAGES.schedulerNotConfigured, 503);
    }
    if (secretCheck.status === "invalid") {
        return forbidden();
    }

    if (!isFeatureEnabled(FEATURE_KEYS.routine)) {
        return NextResponse.json({
            success: true,
            featureEnabled: false,
            ...emptySchedulerResult(),
        });
    }

    try {
        const result = await runRoutineScheduler();
        if (result.errors > 0) {
            return NextResponse.json(
                { success: false, ...result },
                { status: 500 },
            );
        }
        return NextResponse.json({ success: true, ...result });
    } catch {
        return serverError();
    }
}
