import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { unauthorized, forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
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

        const body = (await request.json()) as {
            action?: string;
            rejectReason?: string | null;
            cancelReason?: string | null;
        };
        const action = body.action;

        if (action === "approve" || action === "issue") {
            const issuedResult = await stockService.issueRequest(requestId, user.id);
            const updatedRequest = issuedResult.request;
            await logStockEvent("STOCK_REQUEST_ISSUE", requestId, user.id, user.email);
            try {
                await notifyStockRequestResult(
                    requestId,
                    updatedRequest.requestedBy,
                    true,
                );
            } catch (notificationError) {
                console.error("Error sending stock issued notification:", {
                    requestId,
                    issuerId: user.id,
                    requesterId: updatedRequest.requestedBy,
                    error: notificationError,
                });
            }
            return NextResponse.json({ request: updatedRequest });
        }

        if (action !== "reject" && action !== "cancel") {
            return jsonError("action ต้องเป็น issue หรือ cancel", 400);
        }

        const cancelReason = body.cancelReason ?? body.rejectReason ?? null;
        const updated = await stockService.cancelRequest(
            requestId,
            user.id,
            cancelReason,
        );
        await logStockEvent("STOCK_REQUEST_CANCEL", requestId, user.id, user.email, {
            metadata: { reason: cancelReason },
        });
        try {
            await notifyStockRequestResult(
                requestId,
                updated.requestedBy,
                false,
                cancelReason,
            );
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
            message.includes("ไม่เพียงพอ")
        ) {
            return jsonError(message, 400);
        }
        console.error("Error handling stock request review compatibility route:", error);
        return serverError();
    }
}
