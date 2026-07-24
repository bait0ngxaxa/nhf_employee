import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { createTicketCommandActor } from "@/lib/server/ticket-command-actor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { processOutbox } from "@/lib/services/outbox/processor";
import { ticketService } from "@/lib/services/ticket";
import { TicketIdempotencyConflictError } from "@/lib/services/ticket/idempotency";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    createTicketCommentSchema,
    ticketIdParamSchema,
} from "@/lib/validations/ticket";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "ticket-comment",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const body = await request.json();
        const parsed = createTicketCommentSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!parsedIdempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400);
        }

        const resolvedParams = await params;
        const parsedTicketId = ticketIdParamSchema.safeParse(resolvedParams.id);
        if (!parsedTicketId.success) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse =
            enforceAuthenticatedMutationRateLimit(
                "ticket-comment",
                auth.user.id,
            );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const actor = createTicketCommandActor(auth.user, request.headers);
        const result = await ticketService.createTicketComment(
            parsedTicketId.data,
            parsed.data,
            actor,
            { idempotencyKey: parsedIdempotencyKey.data },
        );

        if (result.outcome === "not_found") {
            return jsonError(COMMON_API_MESSAGES.ticketNotFound, 404);
        }
        if (result.outcome === "forbidden") {
            return jsonError(COMMON_API_MESSAGES.accessDenied, 403);
        }

        if (!result.replayed) {
            after(() =>
                processOutbox().catch((error) => {
                    console.error("Outbox processor failed:", error);
                }),
            );
        }

        return NextResponse.json(
            { comment: result.comment },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        if (error instanceof TicketIdempotencyConflictError) {
            return jsonError(error.message, 409);
        }
        console.error("Error creating comment:", error);
        return jsonError(COMMON_API_MESSAGES.failedToCreateComment, 500);
    }
}
