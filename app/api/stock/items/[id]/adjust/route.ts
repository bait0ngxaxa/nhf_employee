import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { adjustStockSchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
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
        const result = adjustStockSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const adjustment = await stockService.adjustStock(
            itemId,
            result.data,
            user.id,
        );
        await logStockEvent("STOCK_ADJUST", itemId, user.id, user.email, {
            after: {
                type: result.data.type,
                quantity: result.data.quantity,
                previousQty: adjustment.previousQty,
                newQty: adjustment.newQty,
                previousMinStock: adjustment.previousMinStock,
                newMinStock: adjustment.newMinStock,
            },
        });
        return NextResponse.json({ adjustment });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("ไม่พบวัสดุ") ||
            message.includes("ต้องไม่ติดลบ")
        ) {
            return jsonError(message, 400);
        }
        console.error("Error adjusting stock:", error);
        return serverError();
    }
}
