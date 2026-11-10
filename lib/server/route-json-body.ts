import type { NextResponse } from "next/server";

import { readBoundedJsonBody } from "@/lib/server/request-body";
import { jsonError } from "@/lib/ssot/http";
import { REQUEST_BODY_TOO_LARGE_MESSAGE } from "@/lib/ssot/request-limits";

export type RouteJsonBodyResult =
    | { readonly ok: true; readonly body: unknown }
    | { readonly ok: false; readonly response: NextResponse };

export interface RouteJsonBodyOptions {
    /** Limit from lib/ssot/request-limits.ts. */
    readonly maxBytes: number;
    /**
     * The route's pre-existing response for malformed JSON (or an unreadable /
     * non-UTF-8 body). Routes pass their previous response so migrating to the
     * bounded reader does not change the malformed-input contract.
     */
    readonly invalidJson: () => NextResponse;
    /** Extra fields merged into the 413 body to match the route's error shape. */
    readonly tooLargeDetails?: Record<string, unknown>;
}

/**
 * Reads a JSON route body through readBoundedJsonBody. The only new response
 * this introduces is 413 REQUEST_BODY_TOO_LARGE_MESSAGE for an oversized body
 * (Content-Length fast path, then the actual streamed byte count).
 */
export async function readRouteJsonBody(
    request: Request,
    options: RouteJsonBodyOptions,
): Promise<RouteJsonBodyResult> {
    const result = await readBoundedJsonBody(request, options.maxBytes);
    if (result.ok) return { ok: true, body: result.value };

    return {
        ok: false,
        response: result.reason === "TOO_LARGE"
            ? jsonError(REQUEST_BODY_TOO_LARGE_MESSAGE, 413, options.tooLargeDetails)
            : options.invalidJson(),
    };
}
