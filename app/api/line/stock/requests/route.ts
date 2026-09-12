import { after, type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/modules/line";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { createStockCommandActor } from "@/modules/stock";
import {
    enforceStockJsonBodySize,
    readStockJsonBody,
} from "@/modules/stock";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    stockService,
    StockCapabilityDeniedError,
    StockRequestIdempotencyConflictError,
} from "@/modules/stock";
import {
    toLiffStockRequestsResponse,
    toLiffStockRequestSummary,
} from "@/modules/stock";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    createRequestSchema,
    idempotencyKeySchema,
    stockRequestsFilterSchema,
} from "@/modules/stock";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const parsed = stockRequestsFilterSchema.safeParse({
            status: searchParams.get("status"),
            search: searchParams.get("search"),
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "10",
        });
        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const authorization = buildStockAuthorizationContext(
            auth.user,
            auth.employeeId,
            "LIFF_SELF_SERVICE",
        );
        const capabilityAuthorization =
            await assertStockCapabilityForMigration(
                authorization,
                "stock.request.read",
                { requestedScope: "mine" },
            );
        const result = await stockService.getRequests(
            parsed.data,
            {
                userId: capabilityAuthorization.actor.userId,
                scopes: capabilityAuthorization.scopes,
            },
            "mine",
        );
        return NextResponse.json(toLiffStockRequestsResponse(result, "REQUESTER"));
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching LIFF stock requests", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "stock-request-create",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const bodySizeResponse = enforceStockJsonBodySize(request);
        if (bodySizeResponse) return bodySizeResponse;

        const body = await readStockJsonBody(request);
        if (!body.ok) return body.response;
        const parsedBody = createRequestSchema.safeParse(body.body);
        if (!parsedBody.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsedBody.error.flatten().fieldErrors,
            });
        }
        const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!parsedIdempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400);
        }

        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;
        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "stock-request-create",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const creation = await stockService.createRequest(
            parsedBody.data,
            createStockCommandActor(
                auth.user,
                request.headers,
                buildStockAuthorizationContext(
                    auth.user,
                    auth.employeeId,
                    "LIFF_SELF_SERVICE",
                ),
            ),
            { idempotencyKey: parsedIdempotencyKey.data },
        );
        if (!creation.replayed) {
            after(() => {
                processOutbox().catch((error: unknown) =>
                    console.error("Process LIFF stock request outbox failed", {
                        errorType: error instanceof Error
                            ? error.name
                            : "UnknownError",
                    }),
                );
            });
        }

        return NextResponse.json(
            {
                request: toLiffStockRequestSummary(
                    creation.request,
                    "REQUESTER",
                ),
            },
            { status: creation.replayed ? 200 : 201 },
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof SyntaxError) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400);
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        if (error instanceof StockRequestIdempotencyConflictError) {
            return jsonError(error.message, 409);
        }
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("กรุณาเลือก")
            || message.includes("มีไม่เพียงพอ")
            || message.includes("ไม่พบรายการย่อย")
            || message.includes("ไม่ตรงกับวัสดุ")
        ) {
            return jsonError(message, 409);
        }

        console.error("Error creating LIFF stock request", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
