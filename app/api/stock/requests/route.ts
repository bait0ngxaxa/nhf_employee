import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import {
    createRequestSchema,
    stockRequestsFilterSchema,
} from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";
import { notifyAdminsNewStockRequest } from "@/lib/services/stock/notifications";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        const { searchParams } = new URL(request.url);

        const parsed = stockRequestsFilterSchema.safeParse({
            status: searchParams.get("status"),
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
            isAdminRole(user.role),
        );
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching stock requests:", error);
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);

        const body = await request.json();
        const result = createRequestSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const stockRequest = await stockService.createRequest(
            result.data,
            user.id,
        );
        await logStockEvent("STOCK_REQUEST_CREATE", stockRequest.id, user.id, user.email, {
            after: { itemCount: result.data.items.length },
        });

        // Notify admins of the new request
        const requesterName = session.user?.name ?? user.email;
        try {
            await notifyAdminsNewStockRequest(stockRequest.id, requesterName);
        } catch (notificationError) {
            console.error("Error sending stock request notification:", {
                requestId: stockRequest.id,
                requesterId: user.id,
                error: notificationError,
            });
        }

        return NextResponse.json({ request: stockRequest }, { status: 201 });
    } catch (error) {
        console.error("Error creating stock request:", error);
        return serverError();
    }
}
