import { StockRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
    buildStockAuthorizationContext,
    resolveStockCapabilityForMigration,
    StockCapabilityDeniedError,
    requireLiffStockProcessorSession,
    stockService,
    toLiffStockRequestsResponse,
    stockRequestsFilterSchema,
} from "@/modules/stock";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";

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

        const authorization = buildStockAuthorizationContext(
            auth.user,
            auth.employeeId,
            "LIFF_SELF_SERVICE",
        );
        const processAuthorization = await resolveStockCapabilityForMigration(
            authorization,
            "stock.request.process",
            { requestedScope: "all" },
        );
        let canCancel = false;
        try {
            const cancelAuthorization =
                await resolveStockCapabilityForMigration(
                    authorization,
                    "stock.request.cancel",
                    { requestedScope: "all" },
                );
            canCancel = cancelAuthorization.scopes.includes("ALL");
        } catch (error) {
            if (!(error instanceof StockCapabilityDeniedError)) throw error;
        }
        const result = await stockService.getRequests(
            parsed.data,
            {
                userId: processAuthorization.actor.userId,
                scopes: processAuthorization.scopes,
            },
            "all",
        );
        return NextResponse.json(
            toLiffStockRequestsResponse(
                result,
                "PROCESSOR",
                { canIssue: true, canCancel },
            ),
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching LIFF stock processing queue", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
