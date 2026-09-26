import type { NextResponse } from "next/server";

import { forbidden, jsonError, notFound } from "@/lib/ssot/http";

import { ITCapabilityDeniedError } from "../../application/authorization";
import {
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketMutationConflictError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
} from "../../application/ticket-errors";
import { IT_TICKET_DATABASE_INT_MAX } from "../../contracts";
import { ITTicketAttachmentValidationError } from "../../infrastructure/attachments/validation";

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
    if (error instanceof ITTicketMutationConflictError) {
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

function safeErrorMetadata(error: unknown): { errorType: string; errorCode?: string } {
    const rawErrorType = error instanceof Error ? error.name : "UnknownError";
    const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(rawErrorType)
        ? rawErrorType
        : "UnknownError";
    const rawErrorCode = typeof error === "object" && error !== null && "code" in error
        && typeof error.code === "string"
        ? error.code
        : undefined;
    const errorCode = rawErrorCode !== undefined && /^[A-Z0-9_]{1,64}$/.test(rawErrorCode)
        ? rawErrorCode
        : undefined;
    return { errorType, ...(errorCode === undefined ? {} : { errorCode }) };
}

export function logITTicketRouteFailure(
    message: string,
    error: unknown,
): void {
    console.error(`${message}:`, safeErrorMetadata(error));
}
