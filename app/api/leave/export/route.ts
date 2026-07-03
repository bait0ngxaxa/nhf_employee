import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { logDataExport } from "@/lib/server/audit";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { getCurrentLeaveYear } from "@/lib/services/leave/quota-year";
import {
    createLeaveReportXlsxResponse,
    getLeaveReportMeta,
    getLeaveReportYears,
} from "@/lib/services/leave/report-export";
import { jsonError, notFound, operationFailed } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function GET(request: NextRequest): Promise<Response> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
        if (Number.isNaN(userId)) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.invalidUserId },
                { status: 400 },
            );
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return operationFailed(404);
        }

        const url = new URL(request.url);
        const yearParam = url.searchParams.get("year");
        const yearsOnly = url.searchParams.get("yearsOnly") === "1";
        const metaOnly = url.searchParams.get("metaOnly") === "1";
        const format = url.searchParams.get("format");
        const year = yearParam ? Number.parseInt(yearParam, 10) : getCurrentLeaveYear();

        if (yearsOnly) {
            const years = await getLeaveReportYears(managerId);
            return NextResponse.json({ years });
        }

        if (Number.isNaN(year) || year < 2000 || year > 2100) {
            return jsonError("ปีที่ต้องการส่งออกไม่ถูกต้อง", 400);
        }

        const meta = await getLeaveReportMeta(managerId, year);
        if (metaOnly || !format) {
            return NextResponse.json(meta);
        }

        if (format !== "xlsx") {
            return jsonError("รูปแบบไฟล์รายงานไม่ถูกต้อง", 400);
        }

        if (meta.requestCount > meta.maxRows) {
            return jsonError(
                `ส่งออกข้อมูลการลาได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
                400,
                {
                    maxRows: meta.maxRows,
                    recordCount: meta.requestCount,
                },
            );
        }

        const response = await createLeaveReportXlsxResponse(managerId, year);
        after(async () => {
            try {
                await logDataExport("LeaveRequest", userId, auth.user.email, {
                    metadata: {
                        entityType: "LeaveRequest",
                        recordCount: meta.requestCount,
                        employeeCount: meta.employeeCount,
                        filters: { year, format: "xlsx" },
                        exportedAt: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Failed to log leave export audit:", error);
            }
        });

        return response;
    } catch (error) {
        console.error("Leave export error:", error);
        return operationFailed(500);
    }
}
