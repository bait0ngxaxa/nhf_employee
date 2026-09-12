import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    createItemSchema,
    createStockCommandActor,
    StockCapabilityDeniedError,
    stockService,
    stockItemsFilterSchema,
} from "@/modules/stock";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        await assertStockCapabilityForMigration(
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

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const result = createItemSchema.safeParse(body);
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
        await assertStockCapabilityForMigration(
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
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Unique constraint")) {
            return jsonError("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว", 409);
        }
        console.error("Error creating stock item:", error);
        return serverError();
    }
}
