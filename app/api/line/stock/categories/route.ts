import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { stockService } from "@/lib/services/stock";
import { toLiffStockCategory } from "@/lib/services/stock/liff-serialization";
import { serverError } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const categories = await stockService.getCategories();
        return NextResponse.json({
            categories: categories.map(toLiffStockCategory),
        });
    } catch (error) {
        console.error("Error fetching LIFF stock categories", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
