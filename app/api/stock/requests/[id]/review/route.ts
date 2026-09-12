import { after, type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    createStockCommandActor,
    enforceStockJsonBodySize,
    executeCancelStockRequest,
    executeIssueStockRequest,
    readStockJsonBody,
    stockReviewActionSchema,
    StockCapabilityDeniedError,
} from "@/modules/stock";
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
        const bodySizeResponse = enforceStockJsonBodySize(request);
        if (bodySizeResponse) return bodySizeResponse;

        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const body = await readStockJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = stockReviewActionSchema.safeParse(body.body);
        if (!parsed.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const { action } = parsed.data;
        const rateLimitScope =
            action === "approve" || action === "issue"
                ? "stock-request-issue"
                : "stock-request-cancel";

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            rateLimitScope,
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const principalRateLimitResponse =
            enforceAuthenticatedMutationRateLimit(
                rateLimitScope,
                auth.user.id,
            );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const { id } = await params;
        const requestId = Number(id);
        if (isNaN(requestId)) return jsonError("ID ไม่ถูกต้อง", 400);

        const authorization = buildStockAuthorizationContext(
            auth.user,
            "employeeId" in auth ? auth.employeeId : null,
            "DASHBOARD",
        );
        const actor = createStockCommandActor(
            auth.user,
            request.headers,
            authorization,
        );

        if (action === "approve" || action === "issue") {
            await assertStockCapabilityForMigration(
                authorization,
                "stock.request.process",
                { requestedScope: "all" },
            );
            const issuedRequest = await executeIssueStockRequest({
                requestId,
                actor,
            });
            after(() => {
                processOutbox().catch((error) =>
                    console.error("Outbox processor failed:", error),
                );
            });
            return NextResponse.json({ request: issuedRequest });
        }

        if (action !== "reject" && action !== "cancel") {
            return jsonError("action ต้องเป็น issue หรือ cancel", 400);
        }

        const cancelReason =
            parsed.data.cancelReason ?? parsed.data.rejectReason ?? null;
        const capabilityAuthorization =
            await assertStockCapabilityForMigration(
                authorization,
                "stock.request.cancel",
                { requestedScope: "all" },
            );
        const updated = await executeCancelStockRequest({
            requestId,
            actor,
            reason: cancelReason,
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
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("ปิดใช้งานแล้ว") ||
            message.includes("ยังไม่ได้ระบุ")
        ) {
            return jsonError(message, 409);
        }
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
