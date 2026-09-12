import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/modules/line";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    StockCapabilityDeniedError,
    stockService,
    toLiffStockCategory,
} from "@/modules/stock";
import { forbidden, serverError } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        await assertStockCapabilityForMigration(
            buildStockAuthorizationContext(
                auth.user,
                auth.employeeId,
                "LIFF_SELF_SERVICE",
            ),
            "stock.catalog.read",
        );
        const categories = await stockService.getCategories();
        return NextResponse.json({
            categories: categories.map(toLiffStockCategory),
        });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching LIFF stock categories", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
