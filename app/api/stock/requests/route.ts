import { after, type NextRequest, NextResponse } from "next/server";
import {
    requireActiveWorkforceOrAdminSession,
    requireActiveWorkforceSession,
} from "@/lib/auth/workforce";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import {
    assertStockCapabilityForMigration,
    buildStockAuthorizationContext,
    createRequestSchema,
    createStockCommandActor,
    idempotencyKeySchema,
    omitStockRequestIdempotency,
    readStockJsonBody,
    StockCapabilityDeniedError,
    stockService,
    StockRequestIdempotencyConflictError,
    stockRequestsFilterSchema,
} from "@/modules/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { enforceStockJsonBodySize } from "@/modules/stock";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;
        const { searchParams } = new URL(request.url);
        const scopeParam = searchParams.get("scope");
        const scope = scopeParam === "all" ? "all" : "mine";
        const authorization = buildStockAuthorizationContext(
            user,
            "employeeId" in auth ? auth.employeeId : null,
            "DASHBOARD",
        );

        const parsed = stockRequestsFilterSchema.safeParse({
            status: searchParams.get("status"),
            search: searchParams.get("search"),
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "20",
        });

        if (!parsed.success) {
            return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const capabilityAuthorization =
            await assertStockCapabilityForMigration(
                authorization,
                "stock.request.read",
                { requestedScope: scope },
            );

        const result = await stockService.getRequests(
            parsed.data,
            {
                userId: capabilityAuthorization.actor.userId,
                scopes: capabilityAuthorization.scopes,
            },
            scope,
        );
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching stock requests:", error);
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
        const result = createRequestSchema.safeParse(body.body);
        if (!result.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: result.error.flatten().fieldErrors,
            });
        }

        const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!parsedIdempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400);
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;
        const principalRateLimitResponse =
            enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                user.id,
            );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const authorization = buildStockAuthorizationContext(
            user,
            auth.employeeId,
            "DASHBOARD",
        );
        await assertStockCapabilityForMigration(
            authorization,
            "stock.request.create",
            { requestedScope: "mine" },
        );
        const actor = createStockCommandActor(
            user,
            request.headers,
            authorization,
        );
        const creation = await stockService.createRequest(
            result.data,
            actor,
            { idempotencyKey: parsedIdempotencyKey.data },
        );

        if (!creation.replayed) {
            after(() => {
                processOutbox().catch((error) =>
                    console.error("Outbox processor failed:", error),
                );
            });
        }

        return NextResponse.json(
            { request: omitStockRequestIdempotency(creation.request) },
            { status: creation.replayed ? 200 : 201 },
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof WorkforceAuthorizationError) {
            return jsonError(error.message, 403);
        }
        if (error instanceof StockRequestIdempotencyConflictError) {
            return jsonError(error.message, 409);
        }
        const message = error instanceof Error ? error.message : "";
        if (
            message.includes("กรุณาเลือก") ||
            message.includes("มีไม่เพียงพอ")
        ) {
            return jsonError(message, 400);
        }

        console.error("Error creating stock request:", error);
        return serverError();
    }
}
