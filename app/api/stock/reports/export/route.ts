import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    createStockBalanceReportXlsxResponse,
    createStockRequestReportXlsxResponse,
    getStockBalanceReportMeta,
    getStockRequestReportMeta,
    getStockRequestReportYears,
    stockReportExportQuerySchema,
    StockInvariantViolationError,
    StockCapabilityDeniedError,
} from "@/modules/stock";

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        await assertStockCapabilityForMigration(
            buildStockAuthorizationContext(
                auth.user,
                "employeeId" in auth ? auth.employeeId : null,
                "DASHBOARD",
            ),
            "stock.report.export",
        );

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

            return createStockBalanceReportXlsxResponse();
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

        return createStockRequestReportXlsxResponse(resolvedYear);
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Stock export error:", error);

        if (error instanceof StockInvariantViolationError) {
            return serverError();
        }

        if (error instanceof Error) {
            return jsonError(error.message, 400);
        }

        return jsonError("ไม่สามารถส่งออกรีพอร์ตวัสดุได้", 500);
    }
}
