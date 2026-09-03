import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    stockService,
    toLiffStockCatalogResponse,
    stockItemsFilterSchema,
} from "@/modules/stock";
import { jsonError, serverError } from "@/lib/ssot/http";

export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const parsed = stockItemsFilterSchema.safeParse({
            categoryId: searchParams.get("categoryId"),
            search: searchParams.get("search"),
            activeOnly: "true",
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "12",
        });
        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await stockService.getItems(parsed.data);
        return NextResponse.json(toLiffStockCatalogResponse(result));
    } catch (error) {
        console.error("Error fetching LIFF stock items", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
