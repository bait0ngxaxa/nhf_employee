import { withTrustedMutation } from "@/lib/auth/csrf";
import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { DEFAULT_JSON_MUTATION_MAX_BYTES } from "@/lib/ssot/request-limits";
import {
    assertStockCapability,
    buildStockAuthorizationContext,
    createCategorySchema,
    createStockCommandActor,
    StockCapabilityDeniedError,
    stockService,
} from "@/modules/stock";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;
        await assertStockCapability(
            buildStockAuthorizationContext(
                auth.user,
                "employeeId" in auth ? auth.employeeId : null,
                "DASHBOARD",
            ),
            "stock.catalog.read",
        );

        const categories = await stockService.getCategories();
        return NextResponse.json({ categories });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching stock categories:", error);
        return serverError();
    }
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const bodyResult = await readRouteJsonBody(request, {
            maxBytes: DEFAULT_JSON_MUTATION_MAX_BYTES,
        });
        if (!bodyResult.ok) return bodyResult.response;
        const result = createCategorySchema.safeParse(bodyResult.body);
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
        await assertStockCapability(
            authorization,
            "stock.inventory.manage",
        );
        const actor = createStockCommandActor(
            auth.user,
            request.headers,
            authorization,
        );
        const category = await stockService.createCategory(result.data, actor);
        return NextResponse.json({ category }, { status: 201 });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Unique constraint")) {
            return jsonError("หมวดหมู่นี้มีอยู่แล้ว", 409);
        }
        console.error("Error creating stock category:", error);
        return serverError();
    }
});

export const DELETE = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));
        if (!id || isNaN(id)) {
            return jsonError("กรุณาระบุ id หมวดหมู่", 400);
        }

        const authorization = buildStockAuthorizationContext(
            auth.user,
            "employeeId" in auth ? auth.employeeId : null,
            "DASHBOARD",
        );
        await assertStockCapability(
            authorization,
            "stock.inventory.manage",
        );
        const actor = createStockCommandActor(
            auth.user,
            request.headers,
            authorization,
        );
        await stockService.deleteCategory(id, actor);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Foreign key constraint")) {
            return jsonError("ไม่สามารถลบได้ — มีวัสดุอยู่ในหมวดหมู่นี้", 409);
        }
        console.error("Error deleting stock category:", error);
        return serverError();
    }
});
