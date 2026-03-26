import { type NextRequest, NextResponse } from "next/server";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-ssot";

const AJAX_HEADER_NAME = "x-requested-with";
const AJAX_HEADER_VALUE = "XMLHttpRequest";

function buildTrustedOrigins(internalOrigin: string): ReadonlySet<string> {
    const origins = new Set<string>([internalOrigin]);
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    if (nextAuthUrl) {
        origins.add(new URL(nextAuthUrl).origin);
    }
    return origins;
}

function hasTrustedOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    if (!origin) {
        return false;
    }

    const trusted = buildTrustedOrigins(request.nextUrl.origin);
    return trusted.has(origin);
}

function hasAjaxHeader(request: NextRequest): boolean {
    return request.headers.get(AJAX_HEADER_NAME) === AJAX_HEADER_VALUE;
}

export function assertTrustedMutationRequest(request: NextRequest): NextResponse | null {
    if (!hasTrustedOrigin(request) || !hasAjaxHeader(request)) {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.forbidden }, { status: 403 });
    }
    return null;
}

type TrustedMutationHandler = (request: NextRequest) => Promise<NextResponse>;

export function withTrustedMutation(handler: TrustedMutationHandler): TrustedMutationHandler {
    return async (request: NextRequest): Promise<NextResponse> => {
        const csrfError = assertTrustedMutationRequest(request);
        if (csrfError) {
            return csrfError;
        }
        return handler(request);
    };
}

export const AUTH_MUTATION_HEADERS: Readonly<Record<string, string>> = {
    "X-Requested-With": AJAX_HEADER_VALUE,
};
