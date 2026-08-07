import { NextResponse } from "next/server";

import { isFeatureEnabled, FEATURE_KEYS } from "@/lib/ssot/features";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { ROUTINE_API_MESSAGES } from "@/lib/ssot/messages";
import { runRoutineScheduler, type RoutineSchedulerResult } from "@/lib/services/routine";

const ROUTINE_SCHEDULER_SECRET_HEADER = "x-routine-secret";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getExpectedSecret(): string | null {
    const secret = process.env.ROUTINE_SCHEDULER_CRON_SECRET?.trim();
    return secret && secret.length > 0 ? secret : null;
}

function emptySchedulerResult(): RoutineSchedulerResult {
    return {
        occurrencesCreated: 0,
        remindersConsidered: 0,
        outboxEnqueued: 0,
        duplicatesSkipped: 0,
        inactiveSkipped: 0,
        noRecipientSkipped: 0,
        errors: 0,
    };
}

export async function POST(request: Request): Promise<NextResponse> {
    const expectedSecret = getExpectedSecret();
    if (!expectedSecret) {
        return jsonError(ROUTINE_API_MESSAGES.schedulerNotConfigured, 503);
    }

    if (request.headers.get(ROUTINE_SCHEDULER_SECRET_HEADER) !== expectedSecret) {
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
