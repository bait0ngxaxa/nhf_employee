import type { NextResponse } from "next/server";

import { readBoundedJsonBody } from "@/lib/server/request-body";
import { jsonError } from "@/lib/ssot/http";
import type { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    REQUEST_BODY_INVALID_JSON_MESSAGE,
    REQUEST_BODY_TOO_LARGE_MESSAGE,
} from "@/lib/ssot/request-limits";

export type RouteJsonBodyResult =
    | { readonly ok: true; readonly body: unknown }
    | { readonly ok: false; readonly response: NextResponse };

type InvalidJsonDetails = Record<string, unknown> & { readonly error?: never };

export interface RouteJsonBodyOptions {
    /** Limit from lib/ssot/request-limits.ts. */
    readonly maxBytes: number;
    /** Extra envelope fields only; the helper owns the error message and status. */
    readonly invalidJsonDetails?: InvalidJsonDetails;
    /** Preserve authorization administration's existing 400 Bad request contract only. */
    readonly invalidJsonMessage?: typeof COMMON_API_MESSAGES.badRequest;
    /** Extra fields merged into the 413 body to match the route's error shape. */
    readonly tooLargeDetails?: Record<string, unknown>;
    /** Preserve existing endpoint-specific 413 messages. */
    readonly tooLargeMessage?: string;
}

/** Bounded JSON reader: malformed/unreadable JSON is always a client error (400). */
export async function readRouteJsonBody(
    request: Request,
    options: RouteJsonBodyOptions,
): Promise<RouteJsonBodyResult> {
    const result = await readBoundedJsonBody(request, options.maxBytes);
    if (result.ok) return { ok: true, body: result.value };

    return {
        ok: false,
        response: result.reason === "TOO_LARGE"
            ? jsonError(
                options.tooLargeMessage ?? REQUEST_BODY_TOO_LARGE_MESSAGE,
                413,
                options.tooLargeDetails,
            )
            : jsonError(
                options.invalidJsonMessage ?? REQUEST_BODY_INVALID_JSON_MESSAGE,
                400,
                {
                    ...options.invalidJsonDetails,
                    error: options.invalidJsonMessage ?? REQUEST_BODY_INVALID_JSON_MESSAGE,
                },
            ),
    };
}
