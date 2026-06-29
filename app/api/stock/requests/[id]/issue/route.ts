import { after, type NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import { issueRequestSchema } from "@/lib/validations/stock";
import { logStockEvent } from "@/lib/server/audit";
import {
    enqueueLineLowStockReached,
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
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;

        const { id } = await params;
        const requestId = Number(id);
        if (Number.isNaN(requestId)) {
            return jsonError("ID ไม่ถูกต้อง", 400);
        }

        const body = await request.json();
        const parsed = issueRequestSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const issuedResult = await stockService.issueRequest(requestId, auth.user.id);
        const updated = issuedResult.request;
        await logStockEvent("STOCK_REQUEST_ISSUE", requestId, auth.user.id, auth.user.email);

        try {
            await notifyStockRequestResult(requestId, updated.requestedBy, true);
        } catch (notificationError) {
            console.error("Error sending stock issued notification:", {
                requestId,
                issuerId: auth.user.id,
                requesterId: updated.requestedBy,
                error: notificationError,
            });
        }

        after(async () => {
            try {
                await enqueueLineLowStockReached(issuedResult.lowStockAlerts);
                processOutbox().catch((err) =>
                    console.error("Outbox processor failed:", err),
                );
            } catch (notificationError) {
                console.error("Error queueing low stock notification:", {
                    requestId,
                    issuerId: auth.user.id,
                    error: notificationError,
                });
            }
        });

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

        console.error("Error issuing stock request:", error);
        return serverError();
    }
}
