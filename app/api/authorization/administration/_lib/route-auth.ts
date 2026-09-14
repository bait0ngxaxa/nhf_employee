import type { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { forbidden, unauthorized } from "@/lib/ssot/http";
import {
    assertAuthorizationAdministrationAccess,
    AuthorizationAdministrationAccessError,
    type AuthorizationAdministrationPrincipal,
} from "@/modules/authorization";

export type AuthorizationAdministrationApiAuthResult =
    | {
        readonly ok: true;
        readonly principal: AuthorizationAdministrationPrincipal;
    }
    | {
        readonly ok: false;
        readonly response: NextResponse;
    };

/**
 * Shared API boundary for the read-only Authorization Administration contract.
 * Authentication and the existing API workforce lifecycle check happen in
 * requireAdminSession; the application boundary verifies the trusted role and
 * identity shape again before any administration query is reached.
 */
export async function requireAuthorizationAdministrationApiSession(): Promise<
    AuthorizationAdministrationApiAuthResult
> {
    const auth = await requireAdminSession({
        unauthorizedResponse: () => unauthorized(),
        forbiddenResponse: () => forbidden(),
    });
    if (!auth.ok) return auth;

    try {
        return {
            ok: true,
            principal: assertAuthorizationAdministrationAccess({
                userId: auth.user.id,
                systemRole: auth.user.role,
            }),
        };
    } catch (error) {
        if (error instanceof AuthorizationAdministrationAccessError) {
            return { ok: false, response: forbidden() };
        }
        throw error;
    }
}
