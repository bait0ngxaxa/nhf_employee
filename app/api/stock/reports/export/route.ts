import { after, type NextRequest, NextResponse } from "next/server";
import { logDataExport } from "@/lib/audit";
import { getApiAuthSession } from "@/lib/server-auth";
import { isAdminRole } from "@/lib/ssot/permissions";
import { forbidden, jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    createStockBalanceReportCsvResponse,
    getStockBalanceReportMeta,
} from "@/lib/services/stock/balance-export";
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
            reportType: searchParams.get("reportType") ?? undefined,
            format: searchParams.get("format") ?? undefined,
        });

        if (!parsedQuery.success) {
            return jsonError("พารามิเตอร์รีพอร์ตไม่ถูกต้อง", 400, {
                details: parsedQuery.error.flatten().fieldErrors,
            });
        }

        const { year, yearsOnly, metaOnly, reportType } = parsedQuery.data;
        const resolvedYear = year ?? new Date().getFullYear();

        if (reportType === "balances") {
            if (yearsOnly) {
                return jsonError("รีพอร์ตยอดคงเหลือไม่รองรับการเลือกปี", 400);
            }

            const meta = await getStockBalanceReportMeta();
            if (metaOnly) {
                return NextResponse.json({
                    reportType,
                    count: meta.count,
                    maxRows: meta.maxRows,
                });
            }

            if (meta.count > meta.maxRows) {
                return jsonError(
                    `ส่งออกยอดคงเหลือสต๊อกได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง`,
                    400,
                    { count: meta.count, maxRows: meta.maxRows },
                );
            }

            const response = await createStockBalanceReportCsvResponse();

            after(async () => {
                try {
                    await logDataExport("StockItem", userId, session.user.email || "", {
                        metadata: {
                            entityType: "StockItem",
                            recordCount: meta.count,
                            filters: { reportType },
                            exportedAt: new Date().toISOString(),
                        },
                    });
                } catch (error) {
                    console.error("Failed to log stock export audit:", error);
                }
            });

            return response;
        }

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
                await logDataExport("StockRequest", userId, session.user.email || "", {
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

        return jsonError("ไม่สามารถส่งออกรีพอร์ตวัสดุได้", 500);
    }
}
