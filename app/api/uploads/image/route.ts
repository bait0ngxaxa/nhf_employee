import { NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { saveLocalImageUpload } from "@/lib/uploads/local";
import {
    AuthorizationConfigurationError,
} from "@/modules/authorization";
import {
    assertStockCapability,
    buildStockAuthorizationContext,
    StockCapabilityDeniedError,
} from "@/modules/stock";

async function authorizeImageUpload(): Promise<NextResponse | null> {
    const auth = await requireActiveWorkforceOrAdminSession();
    if (!auth.ok) return auth.response;

    try {
        await assertStockCapability(
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
        if (error instanceof AuthorizationConfigurationError) {
            console.error("Error authorizing image upload", {
                errorType: error.name,
                code: error.code,
            });
            return serverError();
        }
        throw error;
    }

    return null;
}

export async function POST(request: Request): Promise<NextResponse> {
    const authorizationResponse = await authorizeImageUpload();
    if (authorizationResponse) return authorizationResponse;

    const formData = await request.formData();
    const scope = formData.get("scope");
    const file = formData.get("file");

    if (scope !== "item" && scope !== "variant") {
        return jsonError("ประเภทไฟล์อัปโหลดไม่ถูกต้อง", 400);
    }

    if (!(file instanceof File)) {
        return jsonError("กรุณาเลือกไฟล์รูปภาพ", 400);
    }

    const currentAuthorizationResponse = await authorizeImageUpload();
    if (currentAuthorizationResponse) return currentAuthorizationResponse;

    try {
        const upload = await saveLocalImageUpload({ scope, file });
        return NextResponse.json({ upload });
    } catch (error) {
        const message = error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ";
        return jsonError(message, 400);
    }
}
