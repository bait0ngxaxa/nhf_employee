import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    cancelRequestSchema,
    createStockCommandActor,
    enforceStockJsonBodySize,
    executeCancelStockRequest,
    readStockJsonBody,
    StockCapabilityDeniedError,
} from "@/modules/stock";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "stock-request-cancel",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const bodySizeResponse = enforceStockJsonBodySize(request);
        if (bodySizeResponse) return bodySizeResponse;

        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;
        const principalRateLimitResponse =
            enforceAuthenticatedMutationRateLimit(
                "stock-request-cancel",
                user.id,
            );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const authorization = buildStockAuthorizationContext(
            user,
            "employeeId" in auth ? auth.employeeId : null,
            "DASHBOARD",
        );
        const capabilityAuthorization =
            await assertStockCapabilityForMigration(
                authorization,
                "stock.request.cancel",
                { requestedScope: "all" },
            );

        const { id } = await params;
        const requestId = Number(id);
        if (Number.isNaN(requestId)) {
            return jsonError("ID ไม่ถูกต้อง", 400);
        }

        const body = await readStockJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = cancelRequestSchema.safeParse(body.body);
        if (!parsed.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const updated = await executeCancelStockRequest({
            requestId,
            actor: createStockCommandActor(
                user,
                request.headers,
                authorization,
            ),
            reason: parsed.data.cancelReason,
            options: {
                notificationMode: capabilityAuthorization.isAdministrative
                    ? "PROCESSOR"
                    : "REQUESTER",
            },
        });

        return NextResponse.json({ request: updated });
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("ไม่พบ") ||
            message.includes("ดำเนินการแล้ว") ||
            message.includes("ไม่มีสิทธิ์")
        ) {
            return message.includes("ไม่มีสิทธิ์")
                ? forbidden()
                : jsonError(message, 400);
        }

        console.error("Error cancelling stock request:", error);
        return serverError();
    }
}
