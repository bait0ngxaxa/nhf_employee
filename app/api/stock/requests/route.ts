import { after, type NextRequest, NextResponse } from "next/server";
import {
    requireActiveWorkforceOrAdminSession,
    requireActiveWorkforceSession,
} from "@/lib/auth/workforce";
import { isAdminRole } from "@/lib/ssot/permissions";
import { jsonError, serverError } from "@/lib/ssot/http";
import { stockService } from "@/lib/services/stock";
import {
    omitStockRequestIdempotency,
    StockRequestIdempotencyConflictError,
} from "@/lib/services/stock/request-idempotency";
import { processOutbox } from "@/lib/services/outbox/processor";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import {
    createRequestSchema,
    idempotencyKeySchema,
    stockRequestsFilterSchema,
} from "@/lib/validations/stock";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        const { user } = auth;
        const { searchParams } = new URL(request.url);
        const scopeParam = searchParams.get("scope");
        const scope = scopeParam === "all" ? "all" : "mine";
        const isAdmin = isAdminRole(user.role);

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

        const result = await stockService.getRequests(
            parsed.data,
            user.id,
            isAdmin,
            scope,
        );
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching stock requests:", error);
        return serverError();
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const result = createRequestSchema.safeParse(body);
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

        const creation = await stockService.createRequest(
            result.data,
            {
                id: user.id,
                email: user.email,
                name: user.name ?? user.email,
            },
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
