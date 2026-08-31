import { type NextRequest, NextResponse } from "next/server";

import { requireLiffStockProcessorSession } from "@/lib/server/liff-stock-auth";
import { createStockCommandActor } from "@/lib/server/stock-command-actor";
import { enforceStockJsonBodySize } from "@/lib/server/stock-api";
import { executeIssueStockRequest } from "@/lib/server/stock-request-commands";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { jsonError, serverError } from "@/lib/ssot/http";
import {
    issueRequestSchema,
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
            "stock-request-issue",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const bodySizeResponse = enforceStockJsonBodySize(request);
        if (bodySizeResponse) return bodySizeResponse;

        const auth = await requireLiffStockProcessorSession();
        if (!auth.ok) return auth.response;
        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "stock-request-issue",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const parsedId = stockRequestIdParamSchema.safeParse((await params).id);
        if (!parsedId.success) return jsonError("ID ไม่ถูกต้อง", 400);
        const parsedBody = issueRequestSchema.safeParse(await request.json());
        if (!parsedBody.success) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400, {
                details: parsedBody.error.flatten().fieldErrors,
            });
        }

        await executeIssueStockRequest({
            requestId: parsedId.data,
            actor: createStockCommandActor(auth.user, request.headers),
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof SyntaxError) {
            return jsonError("ข้อมูลไม่ถูกต้อง", 400);
        }
        const message = error instanceof Error ? error.message : "";
        if (message.includes("ไม่พบ")) return jsonError(message, 404);
        if (
            message.includes("ดำเนินการแล้ว")
            || message.includes("ไม่เพียงพอ")
            || message.includes("ปิดใช้งานแล้ว")
            || message.includes("ยังไม่ได้ระบุ")
        ) {
            return jsonError(message, 409);
        }

        console.error("Error issuing LIFF stock request", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
