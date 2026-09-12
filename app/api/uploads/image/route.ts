import { NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError } from "@/lib/ssot/http";
import { saveLocalImageUpload } from "@/lib/uploads/local";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    StockCapabilityDeniedError,
} from "@/modules/stock";

export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireActiveWorkforceOrAdminSession();
    if (!auth.ok) return auth.response;

    try {
        await assertStockCapabilityForMigration(
            buildStockAuthorizationContext(
                auth.user,
                "employeeId" in auth ? auth.employeeId : null,
                "DASHBOARD",
            ),
            "stock.inventory.manage",
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        throw error;
    }

    const formData = await request.formData();
    const scope = formData.get("scope");
    const file = formData.get("file");

    if (scope !== "item" && scope !== "variant") {
        return jsonError("ประเภทไฟล์อัปโหลดไม่ถูกต้อง", 400);
    }

    if (!(file instanceof File)) {
        return jsonError("กรุณาเลือกไฟล์รูปภาพ", 400);
    }

    try {
        const upload = await saveLocalImageUpload({ scope, file });
        return NextResponse.json({ upload });
    } catch (error) {
        const message = error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ";
        return jsonError(message, 400);
    }
}
