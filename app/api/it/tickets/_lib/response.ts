import type { NextResponse } from "next/server";

import { forbidden, jsonError, notFound } from "@/lib/ssot/http";
import {
    ITCapabilityDeniedError,
    IT_TICKET_DATABASE_INT_MAX,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
    ITTicketAttachmentValidationError,
    ITWorkforceDeniedError,
} from "@/modules/it";

export function mapITTicketRouteError(error: unknown): NextResponse | null {
    if (error instanceof ITCapabilityDeniedError || error instanceof ITWorkforceDeniedError) {
        return forbidden({ success: false });
    }
    if (error instanceof ITTicketInputValidationError) {
        return jsonError(error.message, 400, { success: false });
    }
    if (error instanceof ITTicketAttachmentValidationError) {
        return jsonError(error.message, 400, { success: false });
    }
    if (error instanceof ITTicketIdempotencyConflictError) {
        return jsonError(error.message, 409, { success: false });
    }
    if (error instanceof ITTicketNotFoundError) {
        return notFound({ success: false });
    }
    if (error instanceof ITTicketNotCommentableError) {
        return jsonError(error.message, 409, { success: false, code: error.code });
    }
    return null;
}

export function parseITRequesterTicketId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const ticketId = Number(value);
    return Number.isSafeInteger(ticketId) && ticketId <= IT_TICKET_DATABASE_INT_MAX
        ? ticketId
        : null;
}

export function readITTicketTimelineQuery(
    searchParams: URLSearchParams,
): Record<string, string> | null {
    const result: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
        if ((key !== "limit" && key !== "cursor")
            || Object.prototype.hasOwnProperty.call(result, key)) {
            return null;
        }
        result[key] = value;
    }
    return result;
}
