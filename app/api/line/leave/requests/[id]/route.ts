import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { getAuthorizedLeaveDetail } from "@/lib/services/leave/participant-access";
import { toLiffLeaveRequestDetail } from "@/lib/services/leave/liff-serialization";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound, serverError } from "@/lib/ssot/http";
import { API_ROUTES } from "@/lib/ssot/routes";
import { leaveRequestIdParamSchema } from "@/lib/validations/leave";

interface LeaveDetailRouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(
    _request: Request,
    { params }: LeaveDetailRouteContext,
): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    const parsed = leaveRequestIdParamSchema.safeParse((await params).id);
    if (!parsed.success) return notFound();

    try {
        const detail = await getAuthorizedLeaveDetail(
            parsed.data,
            auth.employeeId,
            API_ROUTES.line.leaveAttachmentById,
        );
        return detail
            ? NextResponse.json(toLiffLeaveRequestDetail(detail))
            : notFound();
    } catch (error) {
        console.error("Read LIFF leave request detail failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
