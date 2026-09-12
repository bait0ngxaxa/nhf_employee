import { type NextRequest, NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    createStockCommandActor,
    StockCapabilityDeniedError,
    stockService,
    updateItemSchema,
} from "@/modules/stock";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
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
        const item = await stockService.updateItem(itemId, result.data, actor);
        return NextResponse.json({ item });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("พบรายการย่อยไม่ถูกต้อง") ||
            message.includes("จำนวนรายการย่อยไม่ตรงกับข้อมูลปัจจุบัน") ||
            message.includes("คำขอรอจ่าย") ||
            message.includes("ไม่สามารถปิดรายการย่อยที่ยังมียอดคงเหลือ")
        ) {
            return jsonError(
                message,
                message.includes("คำขอรอจ่าย")
                    || message.includes("ไม่สามารถปิดรายการย่อยที่ยังมียอดคงเหลือ")
                    ? 409
                    : 400,
            );
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
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const { id } = await params;
        const itemId = Number(id);
        if (isNaN(itemId)) return jsonError("ID ไม่ถูกต้อง", 400);

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
        await stockService.updateItem(
            itemId,
            { isActive: false },
            actor,
            "STOCK_ITEM_DELETE",
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("คำขอรอจ่าย")) {
            return jsonError(message, 409);
        }
        if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
            return jsonError("ไม่พบรายการวัสดุ", 404);
        }

        console.error("Error deleting stock item:", error);
        return serverError();
    }
}
