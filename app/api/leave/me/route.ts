import { NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    getEmployeeLeaveProfile,
    parseEmployeeLeaveHistoryFilters,
} from "@/modules/leave";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const LEAVE_PAGINATION_MESSAGES = {
    invalidPage: "หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1",
    invalidLimit: "จำนวนรายการต่อหน้าต้องอยู่ระหว่าง 1 ถึง 50",
} as const;

export async function GET(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const { employeeId } = auth;

        const url = new URL(req.url);
        const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10);

        if (!Number.isInteger(page) || page < 1) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidPage, 400);
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidLimit, 400);
        }

        const filtersResult = parseEmployeeLeaveHistoryFilters(url);
        if (!filtersResult.success) {
            return jsonError(filtersResult.error, 400);
        }

        return NextResponse.json(await getEmployeeLeaveProfile({
            employeeId,
            page,
            limit,
            filters: filtersResult.filters,
        }));
    } catch (error) {
        console.error("Error fetching leave data:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchLeaveData, 500);
    }
}
