import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { createStockCommandActor } from "@/lib/server/stock-command-actor";
import { executeCancelStockRequest } from "@/lib/server/stock-request-commands";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { jsonError, serverError } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";
import {
    cancelRequestSchema,
    stockRequestIdParamSchema,
} from "@/lib/validations/stock";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext,
): Promise<NextResponse> {
    try {
        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "stock-request-cancel",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;
        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "stock-request-cancel",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const parsedId = stockRequestIdParamSchema.safeParse((await params).id);
        if (!parsedId.success) return jsonError("ID ไม่ถูกต้อง", 400);
        const parsedBody = cancelRequestSchema.safeParse(await request.json());
        if (!parsedBody.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsedBody.error.flatten().fieldErrors,
            });
        }

        await executeCancelStockRequest({
            requestId: parsedId.data,
            actor: createStockCommandActor(auth.user, request.headers),
            reason: parsedBody.data.cancelReason,
            options: { isAdmin: isAdminRole(auth.user.role) },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof SyntaxError) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400);
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("ไม่มีสิทธิ์")) return jsonError(message, 403);
        if (message.includes("ไม่พบ")) return jsonError(message, 404);
        if (message.includes("ดำเนินการแล้ว")) return jsonError(message, 409);

        console.error("Error cancelling LIFF stock request", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
