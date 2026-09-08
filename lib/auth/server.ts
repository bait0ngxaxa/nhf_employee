import { cookies } from "next/headers";

import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { resolveAuthenticatedAccount } from "@/modules/auth";
import { hasEligibleCurrentEmployeeForUser } from "@/modules/employee";

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
 * Compatibility adapter for legacy server API consumers.
 *
 * Generic Auth account resolution intentionally supports a valid User without
 * an Employee. Legacy API authorization retains its pre-J2 Employee
 * eligibility contract here, while the Employee/Department/Leave current-user
 * projection is composed by app/_lib/auth/current-user.ts.
 */
export async function getApiAuthSession(): Promise<ApiAuthSession | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    const account = await resolveAuthenticatedAccount(accessToken);
    if (!account) return null;

    try {
        if (!await hasEligibleCurrentEmployeeForUser(account.userId)) return null;
    } catch {
        return null;
    }

    return {
        user: {
            id: String(account.userId),
            role: account.role,
            email: account.email,
            name: account.name,
        },
    };
}
