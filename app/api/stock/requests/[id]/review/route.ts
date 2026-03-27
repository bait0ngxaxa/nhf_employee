import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { reviewRequestSchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";
import { notifyStockRequestResult } from "@/lib/services/stock/notifications";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) return unauthorized();

        const user = buildUserContext(session);
        if (!isAdminRole(user.role)) return forbidden();

        const { id } = await params;
        const requestId = Number(id);
        if (isNaN(requestId)) return jsonError("ID ไม่ถูกต้อง", 400);

        const body = await request.json();
        const result = reviewRequestSchema.safeParse(body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        if (result.data.action === "approve") {
            const updated = await stockService.approveRequest(
                requestId,
                user.id,
            );
            await logStockEvent("STOCK_REQUEST_APPROVE", requestId, user.id, user.email);
            try {
                await notifyStockRequestResult(requestId, updated.requestedBy, true);
            } catch (notificationError) {
                console.error("Error sending stock approval notification:", {
                    requestId,
                    reviewerId: user.id,
                    requesterId: updated.requestedBy,
                    error: notificationError,
                });
            }
            return NextResponse.json({ request: updated });
        }

        const updated = await stockService.rejectRequest(
            requestId,
            user.id,
            result.data.rejectReason,
        );
        await logStockEvent("STOCK_REQUEST_REJECT", requestId, user.id, user.email, {
            metadata: { reason: result.data.rejectReason },
        });
        try {
            await notifyStockRequestResult(
                requestId,
                updated.requestedBy,
                false,
                result.data.rejectReason,
            );
        } catch (notificationError) {
            console.error("Error sending stock rejection notification:", {
                requestId,
                reviewerId: user.id,
                requesterId: updated.requestedBy,
                error: notificationError,
            });
        }
        return NextResponse.json({ request: updated });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("ไม่พบ") ||
            message.includes("ดำเนินการแล้ว") ||
            message.includes("ไม่เพียงพอ")
        ) {
            return jsonError(message, 400);
        }
        console.error("Error reviewing stock request:", error);
        return serverError();
    }
}
