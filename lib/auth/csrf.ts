import { type NextRequest, NextResponse } from "next/server";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { getConfiguredPublicOrigin } from "@/lib/network/public-url";

const AJAX_HEADER_NAME = "x-requested-with";
const AJAX_HEADER_VALUE = "XMLHttpRequest";

/** Environment switch for routes guarded with TRUSTED_MUTATION_ROLLOUT. */
export const CSRF_ENFORCEMENT_MODE_ENV = "CSRF_ENFORCEMENT_MODE";

export type CsrfEnforcementMode = "enforce" | "report";

export type TrustedMutationCheckFailure =
    | "missing-origin"
    | "untrusted-origin"
    | "missing-ajax-header";

export interface TrustedMutationOptions {
    /**
     * `true` only for routes whose guard is still in staged rollout. Such routes
     * honour CSRF_ENFORCEMENT_MODE=report; every other guarded route always
     * enforces regardless of the switch.
     */
    readonly rollout?: boolean;
}

/** Options for routes newly guarded during the CSRF coverage rollout. */
export const TRUSTED_MUTATION_ROLLOUT: TrustedMutationOptions = Object.freeze({ rollout: true });

/**
 * The single place CSRF_ENFORCEMENT_MODE is read. Only the exact value
 * "report" (case-insensitive) relaxes enforcement; anything else, including an
 * unset or misspelled value, enforces.
 */
export function getCsrfEnforcementMode(): CsrfEnforcementMode {
    const configured = process.env[CSRF_ENFORCEMENT_MODE_ENV]?.trim().toLowerCase();
    return configured === "report" ? "report" : "enforce";
}

function buildTrustedOrigins(internalOrigin: string): ReadonlySet<string> {
    const origins = new Set<string>([internalOrigin]);
    const publicOrigin = getConfiguredPublicOrigin();
    if (publicOrigin) {
        origins.add(publicOrigin);
    }

    return origins;
}

function getTrustedMutationCheckFailure(request: NextRequest): TrustedMutationCheckFailure | null {
    const origin = request.headers.get("origin");
    if (!origin) {
        return "missing-origin";
    }
    if (!buildTrustedOrigins(request.nextUrl.origin).has(origin)) {
        return "untrusted-origin";
    }
    if (request.headers.get(AJAX_HEADER_NAME) !== AJAX_HEADER_VALUE) {
        return "missing-ajax-header";
    }
    return null;
}

function getOriginHostForLog(request: NextRequest): string | null {
    const origin = request.headers.get("origin");
    if (!origin) return null;
    try {
        return new URL(origin).host || "invalid";
    } catch {
        return "invalid";
    }
}

function reportTrustedMutationFailure(
    request: NextRequest,
    check: TrustedMutationCheckFailure,
): void {
    // Sanitized on purpose: route, method, failed check and Origin host only.
    // Never log cookies, tokens, query strings, other headers or bodies.
    console.warn("[csrf] report mode: trusted mutation check failed; request allowed", {
        route: request.nextUrl.pathname,
        method: request.method,
        check,
        originHost: getOriginHostForLog(request),
    });
}

export function assertTrustedMutationRequest(
    request: NextRequest,
    options: TrustedMutationOptions = {},
): NextResponse | null {
    const failure = getTrustedMutationCheckFailure(request);
    if (failure === null) {
        return null;
    }
    if (options.rollout === true && getCsrfEnforcementMode() === "report") {
        reportTrustedMutationFailure(request, failure);
        return null;
    }
    return NextResponse.json({ error: AUTH_ERROR_MESSAGES.forbidden }, { status: 403 });
}

type TrustedMutationHandler<Arguments extends readonly unknown[]> = (
    request: NextRequest,
    ...arguments_: Arguments
) => Promise<NextResponse>;

export function withTrustedMutation<Arguments extends readonly unknown[] = []>(
    handler: TrustedMutationHandler<Arguments>,
    options: TrustedMutationOptions = {},
): TrustedMutationHandler<Arguments> {
    return async (request: NextRequest, ...arguments_: Arguments): Promise<NextResponse> => {
        const csrfError = assertTrustedMutationRequest(request, options);
        if (csrfError) {
            return csrfError;
        }
        return handler(request, ...arguments_);
    };
}

export { AUTH_MUTATION_HEADERS } from "./mutation-headers";
