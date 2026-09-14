import type { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";
import { forbidden, unauthorized } from "@/lib/ssot/http";
import {
    assertAuthorizationAdministrationAccess,
    AuthorizationAdministrationAccessError,
    type AuthorizationAdministrationPrincipal,
} from "@/modules/authorization";
import type { AuthorizationAdministrationMutationContext } from "@/modules/authorization";

export type AuthorizationAdministrationApiAuthResult =
    | {
        readonly ok: true;
        readonly principal: AuthorizationAdministrationPrincipal;
        readonly userEmail: string | null;
    }
    | {
        readonly ok: false;
        readonly response: NextResponse;
    };

/**
 * Shared API boundary for the Authorization Administration contract.
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
            userEmail: auth.user.email,
        };
    } catch (error) {
        if (error instanceof AuthorizationAdministrationAccessError) {
            return { ok: false, response: forbidden() };
        }
        throw error;
    }
}

export type AuthorizationAdministrationApiAuthSuccess = Extract<
    AuthorizationAdministrationApiAuthResult,
    { readonly ok: true }
>;

/**
 * Build mutation context from the already authenticated server result. The
 * request contributes only trusted transport metadata; it never contributes
 * actor identity or system role.
 */
export function buildAuthorizationAdministrationMutationContext(
    auth: AuthorizationAdministrationApiAuthSuccess,
    request: Request,
): AuthorizationAdministrationMutationContext {
    return Object.freeze({
        principal: auth.principal,
        userEmail: auth.userEmail,
        ipAddress: getTrustedClientIp(request.headers),
        userAgent: request.headers.get("user-agent"),
    });
}
