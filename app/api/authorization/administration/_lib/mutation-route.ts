import type { NextResponse } from "next/server";

import { badRequest, forbidden, jsonError, notFound } from "@/lib/ssot/http";
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
    try {
        const body: unknown = await request.json();
        return { ok: true, body };
    } catch {
        return { ok: false, response: badRequest({ code: "INVALID_INPUT" }) };
    }
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
