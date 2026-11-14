import type { NextResponse } from "next/server";

import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { badRequest, forbidden, jsonError, notFound } from "@/lib/ssot/http";
import { DEFAULT_JSON_MUTATION_MAX_BYTES } from "@/lib/ssot/request-limits";
import {
    AuthorizationAdministrationAccessError,
    AuthorizationAdministrationMutationError,
    type AuthorizationAdministrationMutationErrorCode,
} from "@/modules/authorization";

export async function readAuthorizationAdministrationJsonBody(
    request: Request,
): Promise<
    | { readonly ok: true; readonly body: unknown }
    | { readonly ok: false; readonly response: NextResponse }
> {
    const result = await readRouteJsonBody(request, {
        maxBytes: DEFAULT_JSON_MUTATION_MAX_BYTES,
        invalidJsonDetails: { code: "INVALID_INPUT" },
        // Preserve the existing administration API contract byte-for-byte.
        invalidJsonMessage: "Bad request",
    });
    return result.ok
        ? { ok: true, body: result.body }
        : { ok: false, response: result.response };
}

const BAD_REQUEST_CODES = new Set<AuthorizationAdministrationMutationErrorCode>([
    "INVALID_INPUT",
    "UNKNOWN_CAPABILITY",
    "UNSUPPORTED_SCOPE",
    "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
]);

const NOT_FOUND_CODES = new Set<AuthorizationAdministrationMutationErrorCode>([
    "NOT_FOUND",
]);

export function authorizationAdministrationMutationErrorResponse(
    error: unknown,
): NextResponse | null {
    if (error instanceof AuthorizationAdministrationAccessError) {
        return forbidden();
    }
    if (!(error instanceof AuthorizationAdministrationMutationError)) {
        return null;
    }

    if (BAD_REQUEST_CODES.has(error.code)) {
        return badRequest({ code: error.code });
    }
    if (NOT_FOUND_CODES.has(error.code)) {
        return notFound({ code: error.code });
    }

    return jsonError(
        "Authorization Administration mutation rejected",
        409,
        { code: error.code },
    );
}
