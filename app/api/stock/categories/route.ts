import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { createCategorySchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const categories = await stockService.getCategories();
        return NextResponse.json({ categories });
    } catch (error) {
        console.error("Error fetching stock categories:", error);
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        if (!isAdminRole(user.role)) return forbidden();

        const body = await request.json();
        const result = createCategorySchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const category = await stockService.createCategory(result.data);
        await logStockEvent("STOCK_CATEGORY_CREATE", category.id, user.id, user.email, {
            after: { name: result.data.name },
        });
        return NextResponse.json({ category }, { status: 201 });
    } catch (error) {
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
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        if (!isAdminRole(user.role)) return forbidden();

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id"));
        if (!id || isNaN(id)) {
            return jsonError("กรุณาระบุ id หมวดหมู่", 400);
        }

        await stockService.deleteCategory(id);
        await logStockEvent("STOCK_CATEGORY_DELETE", id, user.id, user.email);
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Foreign key constraint")) {
            return jsonError("ไม่สามารถลบได้ — มีวัสดุอยู่ในหมวดหมู่นี้", 409);
        }
        console.error("Error deleting stock category:", error);
        return serverError();
    }
}
