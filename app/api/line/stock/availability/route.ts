import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/modules/line";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    StockCapabilityDeniedError,
    stockService,
    stockVariantAvailabilityQuerySchema,
} from "@/modules/stock";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";

export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const parsed = stockVariantAvailabilityQuerySchema.safeParse({
            variantIds: searchParams.get("variantIds"),
        });
        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        await assertStockCapabilityForMigration(
            buildStockAuthorizationContext(
                auth.user,
                auth.employeeId,
                "LIFF_SELF_SERVICE",
            ),
            "stock.catalog.read",
        );
        const variants = await stockService.getVariantAvailability(
            parsed.data.variantIds,
        );
        return NextResponse.json({ variants });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching LIFF stock availability", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
