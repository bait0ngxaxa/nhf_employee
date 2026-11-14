import { withTrustedMutation } from "@/lib/auth/csrf";
import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { STOCK_ITEM_JSON_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";
import {
    assertStockCapability,
    buildStockAuthorizationContext,
    createItemSchema,
    createStockCommandActor,
    StockCapabilityDeniedError,
    stockService,
    StockVariantSkuConflictError,
    stockItemsFilterSchema,
} from "@/modules/stock";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;
        await assertStockCapability(
            buildStockAuthorizationContext(
                auth.user,
                "employeeId" in auth ? auth.employeeId : null,
                "DASHBOARD",
            ),
            "stock.catalog.read",
        );

        const { searchParams } = new URL(request.url);
        const parsed = stockItemsFilterSchema.safeParse({
            categoryId: searchParams.get("categoryId"),
            search: searchParams.get("search"),
            activeOnly: searchParams.get("activeOnly"),
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "20",
        });

        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await stockService.getItems(parsed.data);
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching stock items:", error);
        return serverError();
    }
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const bodyResult = await readRouteJsonBody(request, {
            maxBytes: STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
            // Pre-existing contract: malformed JSON fell through to the 500 catch.
            invalidJson: () => serverError(),
        });
        if (!bodyResult.ok) return bodyResult.response;
        const result = createItemSchema.safeParse(bodyResult.body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const authorization = buildStockAuthorizationContext(
            auth.user,
            "employeeId" in auth ? auth.employeeId : null,
            "DASHBOARD",
        );
        await assertStockCapability(
            authorization,
            "stock.inventory.manage",
        );
        const actor = createStockCommandActor(
            auth.user,
            request.headers,
            authorization,
        );
        const item = await stockService.createItem(result.data, actor);
        return NextResponse.json({ item }, { status: 201 });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        if (error instanceof StockVariantSkuConflictError) {
            return jsonError(error.message, 409);
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Unique constraint")) {
            return jsonError("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว", 409);
        }
        console.error("Error creating stock item:", error);
        return serverError();
    }
});
