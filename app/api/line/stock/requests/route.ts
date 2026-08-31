import { after, type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { createStockCommandActor } from "@/lib/server/stock-command-actor";
import { enforceStockJsonBodySize } from "@/lib/server/stock-api";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { processOutbox } from "@/lib/services/outbox/processor";
import { stockService } from "@/lib/services/stock";
import { StockRequestIdempotencyConflictError } from "@/lib/services/stock/request-idempotency";
import {
    toLiffStockRequestsResponse,
    toLiffStockRequestSummary,
} from "@/lib/services/stock/liff-serialization";
import { jsonError, serverError } from "@/lib/ssot/http";
import {
    createRequestSchema,
    idempotencyKeySchema,
    stockRequestsFilterSchema,
} from "@/lib/validations/stock";

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

        const result = await stockService.getRequests(
            parsed.data,
            auth.user.id,
            false,
            "mine",
        );
        return NextResponse.json(toLiffStockRequestsResponse(result, "REQUESTER"));
    } catch (error) {
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

        const parsedBody = createRequestSchema.safeParse(await request.json());
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
            createStockCommandActor(auth.user, request.headers),
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
