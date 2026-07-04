import { after, type NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import { adjustStockSchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/server/audit";
import { enqueueLineLowStockReached } from "@/lib/services/stock/notifications";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
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
        const result = adjustStockSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const adjustment = await stockService.adjustStock(
            itemId,
            result.data,
            auth.user.id,
        );
        await logStockEvent("STOCK_ADJUST", itemId, auth.user.id, auth.user.email, {
            after: {
                name: adjustment.itemName,
                sku: adjustment.sku,
                type: result.data.type,
                quantity: result.data.quantity,
                previousQty: adjustment.previousQty,
                newQty: adjustment.newQty,
                previousMinStock: adjustment.previousMinStock,
                newMinStock: adjustment.newMinStock,
            },
        });

        after(async () => {
            try {
                await enqueueLineLowStockReached(adjustment.lowStockAlerts);
                processOutbox().catch((err) =>
                    console.error("Outbox processor failed:", err),
                );
            } catch (notificationError) {
                console.error("Error queueing low stock notification:", {
                    itemId,
                    actorId: auth.user.id,
                    error: notificationError,
                });
            }
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
