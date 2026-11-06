import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { assertStockCapability, buildStockAuthorizationContext, getStockAnalytics, stockAnalyticsQuerySchema, StockCapabilityDeniedError } from "@/modules/stock";

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;
        const authority = await assertStockCapability(buildStockAuthorizationContext(auth.user, "employeeId" in auth ? auth.employeeId : null, "DASHBOARD"), "stock.report.read");
        if (!authority.scopes.includes("ALL")) return forbidden();
        const parsed = stockAnalyticsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
        if (!parsed.success) return jsonError("ตัวกรองรายงานไม่ถูกต้อง กรุณาตรวจสอบช่วงเดือนและหน่วย", 400);
        return NextResponse.json(await getStockAnalytics(parsed.data), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) return forbidden();
        console.error("Stock analytics error:", error);
        return serverError();
    }
}
