import { after, type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    createRequestSchema,
    stockRequestsFilterSchema,
} from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";
import {
    enqueueLineNewStockRequest,
    notifyAdminsNewStockRequest,
} from "@/lib/services/stock/notifications";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
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
            after: {
                itemCount: result.data.items.length,
                projectCode: result.data.projectCode,
            },
        });

        // Notify admins of the new request
        const requesterName = session.user?.name ?? user.email;
        try {
            await notifyAdminsNewStockRequest(
                stockRequest.id,
                requesterName,
                stockRequest.projectCode,
            );
        } catch (notificationError) {
            console.error("Error sending stock request notification:", {
                requestId: stockRequest.id,
                requesterId: user.id,
                error: notificationError,
            });
        }

        after(async () => {
            try {
                await enqueueLineNewStockRequest(stockRequest);
                processOutbox().catch((err) =>
                    console.error("Outbox processor failed:", err),
                );
            } catch (lineNotificationError) {
                console.error("Error queueing LINE stock notification:", {
                    requestId: stockRequest.id,
                    requesterId: user.id,
                    error: lineNotificationError,
                });
            }
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
