import { after, type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { isAdminRole } from "@/lib/ssot/permissions";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    createRequestSchema,
    stockRequestsFilterSchema,
} from "@/lib/validations/stock";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;
        const { searchParams } = new URL(request.url);
        const scopeParam = searchParams.get("scope");
        const scope = scopeParam === "all" ? "all" : "mine";
        const isAdmin = isAdminRole(user.role);

        const parsed = stockRequestsFilterSchema.safeParse({
            status: searchParams.get("status"),
            search: searchParams.get("search"),
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "20",
        });

        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await stockService.getRequests(
            parsed.data,
            user.id,
            isAdmin,
            scope,
        );
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching stock requests:", error);
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;

        const body = await request.json();
        const result = createRequestSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const stockRequest = await stockService.createRequest(result.data, {
            id: user.id,
            email: user.email,
            name: user.name ?? user.email,
        });

        after(() => {
            processOutbox().catch((error) =>
                console.error("Outbox processor failed:", error),
            );
        });

        return NextResponse.json({ request: stockRequest }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("กรุณาเลือก") ||
            message.includes("มีไม่เพียงพอ")
        ) {
            return jsonError(message, 400);
        }

        console.error("Error creating stock request:", error);
        return serverError();
    }
}
