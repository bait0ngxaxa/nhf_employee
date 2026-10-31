import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { contentLengthExceedsLimit, readBoundedJsonBody } from "@/lib/server/request-body";
import { enforceAuthenticatedMutationRateLimit, enforcePreAuthIpRateLimit } from "@/lib/security/mutation-rate-limit";
import { jsonError, notFound, operationFailed } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { HolidayCalendarError, reconcileCalendarLeave } from "@/modules/leave";

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
        const ipLimit = enforcePreAuthIpRateLimit(request, "leave-calendar");
        if (ipLimit) return ipLimit;
        if (contentLengthExceedsLimit(request, 8192)) return jsonError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const rateLimit = enforceAuthenticatedMutationRateLimit("leave-calendar", auth.user.id);
        if (rateLimit) return rateLimit;
        const body = await readBoundedJsonBody(request, 8192);
        if (!body.ok) return jsonError("ข้อมูลไม่ถูกต้องหรือมีขนาดใหญ่เกินไป", body.reason === "TOO_LARGE" ? 413 : 400);
        return NextResponse.json(await reconcileCalendarLeave({ userId: auth.user.id, channel: "DASHBOARD" }, body.value), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error instanceof HolidayCalendarError) return jsonError(error.message, error.statusCode);
        console.error("Calendar reconciliation failed", error);
        return operationFailed();
    }
});
