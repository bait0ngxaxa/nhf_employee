import { after, type NextRequest, NextResponse } from "next/server";
import { logDataExport } from "@/lib/audit";
import { getApiAuthSession } from "@/lib/server-auth";
import { isAdminRole } from "@/lib/ssot/permissions";
import { forbidden, jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    createStockRequestReportCsvResponse,
    getStockRequestReportMeta,
    getStockRequestReportYears,
} from "@/lib/services/stock/report-export";
import { stockReportExportQuerySchema } from "@/lib/validations/stock";

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        if (!isAdminRole(session.user.role)) {
            return forbidden();
        }

        const userId = Number(session.user.id);
        if (Number.isNaN(userId)) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.invalidUserId },
                { status: 400 },
            );
        }

        const { searchParams } = new URL(request.url);
        const parsedQuery = stockReportExportQuerySchema.safeParse({
            year: searchParams.get("year") ?? undefined,
            yearsOnly: searchParams.get("yearsOnly") ?? undefined,
            metaOnly: searchParams.get("metaOnly") ?? undefined,
            format: searchParams.get("format") ?? undefined,
        });

        if (!parsedQuery.success) {
            return jsonError("พารามิเตอร์รีพอร์ตไม่ถูกต้อง", 400, {
                details: parsedQuery.error.flatten().fieldErrors,
            });
        }

        const { year, yearsOnly, metaOnly } = parsedQuery.data;
        const resolvedYear = year ?? new Date().getFullYear();

        if (yearsOnly) {
            const years = await getStockRequestReportYears();
            return NextResponse.json({ years });
        }

        const meta = await getStockRequestReportMeta(resolvedYear);
        if (metaOnly) {
            return NextResponse.json({
                year: resolvedYear,
                count: meta.count,
                maxRows: meta.maxRows,
            });
        }

        if (meta.count > meta.maxRows) {
            return jsonError(
                `ส่งออกรายงานเบิกวัสดุได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
                400,
                { count: meta.count, maxRows: meta.maxRows },
            );
        }

        const response = await createStockRequestReportCsvResponse(resolvedYear);

        after(async () => {
            try {
                await logDataExport(userId, session.user.email || "", {
                    metadata: {
                        entityType: "StockRequest",
                        recordCount: meta.count,
                        filters: { year: resolvedYear },
                        exportedAt: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Failed to log stock export audit:", error);
            }
        });

        return response;
    } catch (error) {
        console.error("Stock export error:", error);

        if (error instanceof Error) {
            return jsonError(error.message, 400);
        }

        return jsonError("ไม่สามารถส่งออกรายงานเบิกวัสดุได้", 500);
    }
}
