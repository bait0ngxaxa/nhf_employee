import { after } from "next/server";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { createTicketCommandActor } from "@/lib/server/ticket-command-actor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { processOutbox } from "@/lib/services/outbox/processor";
import { ticketService, type UpdateTicketData } from "@/lib/services/ticket";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    deleteTicketSchema,
    ticketIdParamSchema,
    updateTicketSchema,
} from "@/lib/validations/ticket";

async function parseTicketId(
    params: Promise<{ id: string }>,
): Promise<{ ticketId: number | null; error?: NextResponse }> {
    const resolvedParams = await params;
    const parsedTicketId = ticketIdParamSchema.safeParse(resolvedParams.id);

    if (!parsedTicketId.success) {
        return {
            ticketId: null,
            error: jsonError(COMMON_API_MESSAGES.invalidTicketId, 400),
        };
    }

    return { ticketId: parsedTicketId.data };
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const result = await ticketService.getTicketById(ticketId, auth.user);

        if (result.error) {
            return jsonError(result.error, result.status || 500);
        }

        await ticketService.recordTicketView(ticketId, auth.user.id);
        return NextResponse.json({ ticket: result.ticket }, { status: 200 });
    } catch (error) {
        console.error("Error fetching ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchTicket, 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "ticket-update",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const body = await request.json();
        const validationResult = updateTicketSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.flatten();
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: errors.fieldErrors,
            });
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse =
            enforceAuthenticatedMutationRateLimit(
                "ticket-update",
                auth.user.id,
            );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const updateData: UpdateTicketData = {
            title: validationResult.data.title,
            description: validationResult.data.description,
            category: validationResult.data.category,
            priority: validationResult.data.priority,
            status: validationResult.data.status,
            assignedToId: validationResult.data.assignedToId,
        };

        const actor = createTicketCommandActor(auth.user, request.headers);
        const result = await ticketService.updateTicket(ticketId, updateData, actor);
        if (result.error) {
            return jsonError(result.error, result.status || 500);
        }

        after(() =>
            processOutbox().catch((error) => {
                console.error("Outbox processor failed:", error);
            }),
        );

        return NextResponse.json({ ticket: result.ticket }, { status: 200 });
    } catch (error) {
        console.error("Error updating ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToUpdateTicket, 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "ticket-delete",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const body: unknown = await request.json().catch(() => null);
        const validation = deleteTicketSchema.safeParse(body);
        if (!validation.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: validation.error.flatten().fieldErrors,
            });
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse =
            enforceAuthenticatedMutationRateLimit(
                "ticket-delete",
                auth.user.id,
            );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const actor = createTicketCommandActor(auth.user, request.headers);
        const result = await ticketService.deleteTicket(
            ticketId,
            validation.data.reason,
            actor,
        );

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        return NextResponse.json({ message: COMMON_API_MESSAGES.ticketDeletedSuccessfully }, { status: 200 });
    } catch (error) {
        console.error("Error deleting ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToDeleteTicket, 500);
    }
}
