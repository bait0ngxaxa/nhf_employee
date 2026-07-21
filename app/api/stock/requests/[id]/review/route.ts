import { type NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, serverError } from "@/lib/ssot/http";
import {
    executeCancelStockRequest,
    executeIssueStockRequest,
} from "@/lib/server/stock-request-commands";
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
            const issuedRequest = await executeIssueStockRequest({
                requestId,
                actor: {
                    id: auth.user.id,
                    email: auth.user.email,
                    name: auth.user.name ?? auth.user.email,
                },
            });
            return NextResponse.json({ request: issuedRequest });
        }

        if (action !== "reject" && action !== "cancel") {
            return jsonError("action ต้องเป็น issue หรือ cancel", 400);
        }

        const cancelReason =
            parsed.data.cancelReason ?? parsed.data.rejectReason ?? null;
        const updated = await executeCancelStockRequest({
            requestId,
            actor: {
                id: auth.user.id,
                email: auth.user.email,
                name: auth.user.name ?? auth.user.email,
            },
            reason: cancelReason,
            options: { isAdmin: true },
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
        console.error("Error handling stock request review compatibility route:", error);
        return serverError();
    }
}
