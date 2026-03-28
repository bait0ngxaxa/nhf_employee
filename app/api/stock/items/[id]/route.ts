import { type NextRequest, NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { updateItemSchema } from "@/lib/validations/stock";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        if (!isAdminRole(user.role)) return forbidden();

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

        const item = await stockService.updateItem(itemId, result.data);
        return NextResponse.json({ item });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("พบรายการย่อยไม่ถูกต้อง") ||
            message.includes("จำนวนรายการย่อยไม่ตรงกับข้อมูลปัจจุบัน")
        ) {
            return jsonError(message, 400);
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
    _request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        if (!isAdminRole(user.role)) return forbidden();

        const { id } = await params;
        const itemId = Number(id);
        if (isNaN(itemId)) return jsonError("ID ไม่ถูกต้อง", 400);

        await stockService.updateItem(itemId, { isActive: false });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
            return jsonError("ไม่พบรายการวัสดุ", 404);
        }

        console.error("Error deleting stock item:", error);
        return serverError();
    }
}
