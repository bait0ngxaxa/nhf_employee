import { cookies } from "next/headers";

import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { resolveAuthenticatedAccount } from "@/modules/auth";

export interface ApiAuthUser {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
}

export interface ApiAuthSession {
    user: ApiAuthUser;
}

/**
 * Compatibility adapter for generic server consumers.
 *
 * This boundary exposes only the DB-authoritative authenticated account. The
 * Employee/Department/Leave current-user projection is composed by the
 * delivery seam in app/_lib/auth/current-user.ts.
 */
export async function getApiAuthSession(): Promise<ApiAuthSession | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    const account = await resolveAuthenticatedAccount(accessToken);
    if (!account) return null;

    return {
        user: {
            id: String(account.userId),
            role: account.role,
            email: account.email,
            name: account.name,
        },
    };
}
