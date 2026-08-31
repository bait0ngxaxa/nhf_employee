import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { stockService } from "@/lib/services/stock";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockVariantAvailabilityQuerySchema } from "@/lib/validations/stock";

export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const parsed = stockVariantAvailabilityQuerySchema.safeParse({
            variantIds: searchParams.get("variantIds"),
        });
        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const variants = await stockService.getVariantAvailability(
            parsed.data.variantIds,
        );
        return NextResponse.json({ variants });
    } catch (error) {
        console.error("Error fetching LIFF stock availability", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
