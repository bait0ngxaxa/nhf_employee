import { StockRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
    requireLiffStockProcessorSession,
    stockService,
    toLiffStockRequestsResponse,
    stockRequestsFilterSchema,
} from "@/modules/stock";
import { jsonError, serverError } from "@/lib/ssot/http";

export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireLiffStockProcessorSession();
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const parsed = stockRequestsFilterSchema.safeParse({
            status: StockRequestStatus.PENDING_ISSUE,
            search: searchParams.get("search"),
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "10",
        });
        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await stockService.getRequests(
            parsed.data,
            auth.user.id,
            true,
            "all",
        );
        return NextResponse.json(toLiffStockRequestsResponse(result, "PROCESSOR"));
    } catch (error) {
        console.error("Error fetching LIFF stock processing queue", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
