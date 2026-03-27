import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { createItemSchema, stockItemsFilterSchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

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
        console.error("Error fetching stock items:", error);
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        if (!isAdminRole(user.role)) return forbidden();

        const body = await request.json();
        const result = createItemSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const item = await stockService.createItem(result.data);
        await logStockEvent("STOCK_ITEM_CREATE", item.id, user.id, user.email, {
            after: { name: item.name, sku: item.sku },
        });
        return NextResponse.json({ item }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Unique constraint")) {
            return jsonError("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว", 409);
        }
        console.error("Error creating stock item:", error);
        return serverError();
    }
}
