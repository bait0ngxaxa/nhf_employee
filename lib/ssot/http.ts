import { NextResponse } from "next/server";

import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

type JsonRecord = Record<string, unknown>;

export function jsonOk(body: JsonRecord, status = 200): NextResponse {
    return NextResponse.json(body, { status });
}

export function jsonError(
    message: string,
    status: number,
    details?: JsonRecord,
): NextResponse {
    return NextResponse.json(
        details ? { error: message, ...details } : { error: message },
        { status },
    );
}

export function unauthorized(details?: JsonRecord): NextResponse {
    return jsonError(COMMON_API_MESSAGES.unauthorized, 401, details);
}

export function forbidden(details?: JsonRecord): NextResponse {
    return jsonError(COMMON_API_MESSAGES.forbidden, 403, details);
}

export function badRequest(details?: JsonRecord): NextResponse {
    return jsonError(COMMON_API_MESSAGES.badRequest, 400, details);
}

export function operationFailed(status = 500, details?: JsonRecord): NextResponse {
    return jsonError(COMMON_API_MESSAGES.operationFailed, status, details);
}

export function serverError(details?: JsonRecord): NextResponse {
    return jsonError(COMMON_API_MESSAGES.internalServerError, 500, details);
}

