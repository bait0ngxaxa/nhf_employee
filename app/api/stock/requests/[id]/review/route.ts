import { type NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { logStockEvent } from "@/lib/server/audit";
import { notifyStockRequestResult } from "@/lib/services/stock/notifications";
import { stockReviewActionSchema } from "@/lib/validations/stock";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;

        const { id } = await params;
        const requestId = Number(id);
        if (isNaN(requestId)) return jsonError("ID ไม่ถูกต้อง", 400);

        const body = await request.json();
        const parsed = stockReviewActionSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const { action } = parsed.data;

        if (action === "approve" || action === "issue") {
            const issuedResult = await stockService.issueRequest(requestId, auth.user.id);
            const updatedRequest = issuedResult.request;
            await logStockEvent("STOCK_REQUEST_ISSUE", requestId, auth.user.id, auth.user.email);
            try {
                await notifyStockRequestResult(
                    requestId,
                    updatedRequest.requestedBy,
                    true,
                );
            } catch (notificationError) {
                console.error("Error sending stock issued notification:", {
                    requestId,
                    issuerId: auth.user.id,
                    requesterId: updatedRequest.requestedBy,
                    error: notificationError,
                });
            }
            return NextResponse.json({ request: updatedRequest });
        }

        if (action !== "reject" && action !== "cancel") {
            return jsonError("action ต้องเป็น issue หรือ cancel", 400);
        }

        const cancelReason =
            parsed.data.cancelReason ?? parsed.data.rejectReason ?? null;
        const updated = await stockService.cancelRequest(
            requestId,
            auth.user.id,
            cancelReason,
        );
        await logStockEvent("STOCK_REQUEST_CANCEL", requestId, auth.user.id, auth.user.email, {
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
                cancellerId: auth.user.id,
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
