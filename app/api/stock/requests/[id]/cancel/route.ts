import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { isAdminRole } from "@/lib/ssot/permissions";
import { jsonError, serverError } from "@/lib/ssot/http";
import { executeCancelStockRequest } from "@/lib/server/stock-request-commands";
import { cancelRequestSchema } from "@/lib/validations/stock";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { createStockCommandActor } from "@/lib/server/stock-command-actor";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;
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

        const updated = await executeCancelStockRequest({
            requestId,
            actor: createStockCommandActor(user, request.headers),
            reason: parsed.data.cancelReason,
            options: { isAdmin },
        });

        return NextResponse.json({ request: updated });
    } catch (error) {
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
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
