import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { cancelRequestSchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/audit";
import {
    notifyAdminsStockRequestCancelledByRequester,
    notifyStockRequestResult,
} from "@/lib/services/stock/notifications";

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
        const isAdmin = isAdminRole(user.role);

        const { id } = await params;
        const requestId = Number(id);
        if (Number.isNaN(requestId)) {
            return jsonError("ID ไม่ถูกต้อง", 400);
        }

        const body = await request.json();
        const parsed = cancelRequestSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const updated = await stockService.cancelRequest(
            requestId,
            user.id,
            parsed.data.cancelReason,
            { isAdmin },
        );
        await logStockEvent("STOCK_REQUEST_CANCEL", requestId, user.id, user.email, {
            metadata: { reason: parsed.data.cancelReason },
        });

        try {
            await notifyStockRequestResult(
                requestId,
                updated.requestedBy,
                false,
                parsed.data.cancelReason,
            );
            if (!isAdmin) {
                await notifyAdminsStockRequestCancelledByRequester(
                    requestId,
                    user.name ?? user.email,
                );
            }
        } catch (notificationError) {
            console.error("Error sending stock cancellation notification:", {
                requestId,
                cancellerId: user.id,
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
            message.includes("ไม่มีสิทธิ์")
        ) {
            return jsonError(message, 400);
        }

        console.error("Error cancelling stock request:", error);
        return serverError();
    }
}
