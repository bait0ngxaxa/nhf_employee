import type { NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound } from "@/lib/ssot/http";
import { buildLeaveAuthorizationContext, handleLeaveCalculationPreview } from "@/modules/leave";

export async function GET(request: Request): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) return auth.response;
    return handleLeaveCalculationPreview(request, buildLeaveAuthorizationContext(auth.user, auth.employeeId, "DASHBOARD"));
}
