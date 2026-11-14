import { type NextRequest, NextResponse } from "next/server";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { getConfiguredPublicOrigin } from "@/lib/network/public-url";

const AJAX_HEADER_NAME = "x-requested-with";
const AJAX_HEADER_VALUE = "XMLHttpRequest";

export type TrustedMutationCheckFailure =
    | "missing-origin"
    | "untrusted-origin"
    | "missing-ajax-header";

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

export function assertTrustedMutationRequest(
    request: NextRequest,
): NextResponse | null {
    const failure = getTrustedMutationCheckFailure(request);
    if (failure === null) {
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
): TrustedMutationHandler<Arguments> {
    return async (request: NextRequest, ...arguments_: Arguments): Promise<NextResponse> => {
        const csrfError = assertTrustedMutationRequest(request);
        if (csrfError) {
            return csrfError;
        }
        return handler(request, ...arguments_);
    };
}

export { AUTH_MUTATION_HEADERS } from "./mutation-headers";
