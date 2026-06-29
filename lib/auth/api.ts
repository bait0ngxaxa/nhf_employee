import type { NextResponse } from "next/server";

import { buildUserContext, type UserContext } from "@/lib/auth/context";
import { getApiAuthSession, type ApiAuthSession } from "@/lib/auth/server";
import { forbidden, unauthorized } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";

type AuthResponseFactory = () => NextResponse;

type AuthResponseOptions = {
    unauthorizedResponse?: AuthResponseFactory;
    forbiddenResponse?: AuthResponseFactory;
};

type ApiAuthSuccess = {
    ok: true;
    session: ApiAuthSession;
    user: UserContext;
};

type ApiAuthFailure = {
    ok: false;
    response: NextResponse;
};

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

function unauthorizedFailure(
    options: AuthResponseOptions,
): ApiAuthFailure {
    return {
        ok: false,
        response: options.unauthorizedResponse?.() ?? unauthorized(),
    };
}

function forbiddenFailure(options: AuthResponseOptions): ApiAuthFailure {
    return {
        ok: false,
        response: options.forbiddenResponse?.() ?? forbidden(),
    };
}

export async function requireApiSession(
    options: AuthResponseOptions = {},
): Promise<ApiAuthResult> {
    const session = await getApiAuthSession();
    if (!session) {
        return unauthorizedFailure(options);
    }

    return {
        ok: true,
        session,
        user: buildUserContext(session),
    };
}

export async function requireAdminSession(
    options: AuthResponseOptions = {},
): Promise<ApiAuthResult> {
    const auth = await requireApiSession(options);
    if (!auth.ok) {
        return auth;
    }

    if (!isAdminRole(auth.user.role)) {
        return forbiddenFailure(options);
    }

    return auth;
}
