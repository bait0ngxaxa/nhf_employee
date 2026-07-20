import { after, type NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import { adjustStockSchema } from "@/lib/validations/stock";

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

        const adjustment = await stockService.adjustStock(itemId, result.data, {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name ?? auth.user.email,
        });

        after(() => {
            processOutbox().catch((error) =>
                console.error("Outbox processor failed:", error),
            );
        });

        return NextResponse.json({ adjustment });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("ไม่พบวัสดุ") ||
            message.includes("ต้องไม่ติดลบ") ||
            message.includes("รายการย่อยของวัสดุ")
        ) {
            return jsonError(message, 400);
        }
        console.error("Error adjusting stock:", error);
        return serverError();
    }
}
