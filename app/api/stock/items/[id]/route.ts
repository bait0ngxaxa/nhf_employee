import { type NextRequest, NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { updateItemSchema } from "@/lib/validations/stock";
import { createStockCommandActor } from "@/lib/server/stock-command-actor";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;

        const { id } = await params;
        const itemId = Number(id);
        if (isNaN(itemId)) return jsonError("ID ไม่ถูกต้อง", 400);

        const body = await request.json();
        const result = updateItemSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const actor = createStockCommandActor(auth.user, request.headers);
        const item = await stockService.updateItem(itemId, result.data, actor);
        return NextResponse.json({ item });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("พบรายการย่อยไม่ถูกต้อง") ||
            message.includes("จำนวนรายการย่อยไม่ตรงกับข้อมูลปัจจุบัน")
        ) {
            return jsonError(message, 400);
        }
        if (message.includes("ยอดคงเหลือของรายการย่อยเปลี่ยนแปลงแล้ว")) {
            return jsonError(message, 409);
        }

        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === "P2025") {
                return jsonError("ไม่พบรายการวัสดุ", 404);
            }
            if (error.code === "P2002") {
                return jsonError("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว", 409);
            }
        }

        console.error("Error updating stock item:", error);
        return serverError();
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;

        const { id } = await params;
        const itemId = Number(id);
        if (isNaN(itemId)) return jsonError("ID ไม่ถูกต้อง", 400);

        const actor = createStockCommandActor(auth.user, request.headers);
        await stockService.updateItem(
            itemId,
            { isActive: false },
            actor,
            "STOCK_ITEM_DELETE",
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
            return jsonError("ไม่พบรายการวัสดุ", 404);
        }

        console.error("Error deleting stock item:", error);
        return serverError();
    }
}
