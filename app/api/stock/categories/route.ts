import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    createCategorySchema,
    createStockCommandActor,
    StockCapabilityDeniedError,
    stockService,
} from "@/modules/stock";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        await assertStockCapabilityForMigration(
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

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const result = createCategorySchema.safeParse(body);
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
        const category = await stockService.createCategory(result.data, actor);
        return NextResponse.json({ category }, { status: 201 });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Unique constraint")) {
            return jsonError("หมวดหมู่นี้มีอยู่แล้ว", 409);
        }
        console.error("Error creating stock category:", error);
        return serverError();
    }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
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
        await assertStockCapabilityForMigration(
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
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Foreign key constraint")) {
            return jsonError("ไม่สามารถลบได้ — มีวัสดุอยู่ในหมวดหมู่นี้", 409);
        }
        console.error("Error deleting stock category:", error);
        return serverError();
    }
}
