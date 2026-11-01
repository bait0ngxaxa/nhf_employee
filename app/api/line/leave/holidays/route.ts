import type { NextResponse } from "next/server";
import { requireLiffWorkforceSession } from "@/modules/line";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound, serverError } from "@/lib/ssot/http";
import { getHolidayReferenceResponse } from "@/modules/leave";

export async function GET(): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;
        return await getHolidayReferenceResponse();
    } catch {
        return serverError();
    }
}
