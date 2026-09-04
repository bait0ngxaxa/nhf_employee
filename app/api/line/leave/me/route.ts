import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    getEmployeeLeaveActions,
    getEmployeeLeaveProfile,
    parseEmployeeLeaveHistoryFilters,
    toLiffEmployeeLeaveRequest,
    toLiffLeaveQuota,
} from "@/modules/leave";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound, serverError } from "@/lib/ssot/http";
import { API_ROUTES } from "@/lib/ssot/routes";

const LIFF_LEAVE_PAGE_SIZE = 10;

export async function GET(request: Request): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();

    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const rawPage = url.searchParams.get("page") ?? "1";
        if (!/^\d+$/.test(rawPage)) {
            return jsonError("หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1", 400);
        }
        const page = Number(rawPage);
        if (!Number.isSafeInteger(page) || page < 1) {
            return jsonError("หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1", 400);
        }
        const filters = parseEmployeeLeaveHistoryFilters(url);
        if (!filters.success) return jsonError(filters.error, 400);

        const profile = await getEmployeeLeaveProfile({
            employeeId: auth.employeeId,
            page,
            limit: LIFF_LEAVE_PAGE_SIZE,
            filters: filters.filters,
            buildAttachmentUrl: API_ROUTES.line.leaveAttachmentById,
        });
        return NextResponse.json({
            quotas: profile.quotas.map(toLiffLeaveQuota),
            history: profile.history.map((item) =>
                toLiffEmployeeLeaveRequest(item, getEmployeeLeaveActions(item)),
            ),
            metadata: profile.metadata,
        });
    } catch (error) {
        console.error("Error fetching LIFF leave profile", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
