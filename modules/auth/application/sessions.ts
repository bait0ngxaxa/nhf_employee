import {
    buildRefreshTokenRecord,
    hashRefreshToken,
    issueAccessToken,
    verifyAccessToken,
} from "@/lib/auth/hybrid/tokens";
import {
    findAccountForLogout,
    findAccountForResolution,
} from "../infrastructure/persistence/account-repository";
import { hasEligibleEmployeeLifecycle } from "@/modules/employee";
import {
    findActiveOwnedRefreshToken,
    findRefreshTokenByHash,
    findRefreshTokenFamily,
    hasActiveSessionFamily,
    listActiveRefreshSessions,
    cleanupRefreshTokens,
    revokeAllRefreshTokensForUser,
    revokeCurrentRefreshToken,
    revokeRefreshFamily,
    rotateRefreshTokenAtomically,
} from "../infrastructure/persistence/refresh-token-repository";
import { parseAuthenticatedUserId } from "../domain/principal";
import type {
    AuthClientMetadata,
    AuthenticatedAccount,
    AuthenticatedPrincipal,
    AuthSessionItem,
    RefreshResult,
} from "./types";

export async function refreshHybridSession(input: {
    rawRefreshToken?: string;
    metadata: AuthClientMetadata;
}): Promise<RefreshResult> {
    if (!input.rawRefreshToken) {
        return { status: "unauthorized" };
    }

    const existingToken = await findRefreshTokenByHash(
        hashRefreshToken(input.rawRefreshToken),
    );
    if (!existingToken) {
        return { status: "unauthorized" };
    }

    const now = new Date();
    const nextToken = buildRefreshTokenRecord({
        userId: existingToken.userId,
        familyId: existingToken.familyId,
        userAgent: input.metadata.userAgent,
        ipAddress: input.metadata.ipAddress,
    });
    const rotation = await rotateRefreshTokenAtomically({
        userId: existingToken.userId,
        tokenId: existingToken.id,
        now,
        nextToken: nextToken.record,
    });

    if (rotation.status === "confirmedReuse" || rotation.status === "expired") {
        return {
            status: "unauthorized",
            securityEvent: {
                userId: existingToken.userId,
                email: existingToken.user.email,
                familyId: existingToken.familyId,
                reason: "refresh_token_reuse_or_expired",
                ipAddress: input.metadata.ipAddress,
                userAgent: input.metadata.userAgent,
            },
        };
    }

    if (rotation.status === "revoked") {
        return { status: "unauthorized" };
    }

    if (rotation.status === "inactiveAccount") {
        return {
            status: "unauthorized",
            securityEvent: {
                userId: existingToken.userId,
                email: existingToken.user.email,
                familyId: existingToken.familyId,
                reason: "inactive_user_refresh_attempt",
                ipAddress: input.metadata.ipAddress,
                userAgent: input.metadata.userAgent,
            },
        };
    }

    if (rotation.status === "concurrentCompletion") {
        return {
            status: "unauthorized",
            preserveCookies: true,
        };
    }

    if (rotation.status === "invalid") {
        return { status: "unauthorized" };
    }

    const accessToken = await issueAccessToken({
        userId: existingToken.userId,
        role: rotation.account.role,
        sessionId: existingToken.familyId,
        tokenVersion: rotation.account.tokenVersion,
    });

    return {
        status: "success",
        accessToken,
        rawRefreshToken: nextToken.rawToken,
    };
}

export async function resolveAuthenticatedPrincipal(
    accessToken?: string,
): Promise<AuthenticatedPrincipal | null> {
    const account = await resolveAuthenticatedAccount(accessToken);
    if (!account) return null;

    return {
        userId: account.userId,
        role: account.role,
        sessionFamilyId: account.sessionFamilyId,
        tokenVersion: account.tokenVersion,
    };
}

export async function resolveAuthenticatedAccount(
    accessToken?: string,
): Promise<AuthenticatedAccount | null> {
    if (!accessToken) return null;

    try {
        const claims = await verifyAccessToken(accessToken);
        const userId = parseAuthenticatedUserId(claims.sub);
        if (!userId) return null;

        const hasActiveSession = await hasActiveSessionFamily(userId, claims.sessionId);
        if (!hasActiveSession) return null;

        const user = await findAccountForResolution(userId);
        const hasEligibleEmployee = hasEligibleEmployeeLifecycle(user?.employee ?? null);

        if (
            user?.isActive !== true
            || user.deletedAt !== null
            || user.tokenVersion !== claims.tokenVersion
            || !hasEligibleEmployee
        ) {
            return null;
        }

        return {
            userId,
            role: user.role,
            sessionFamilyId: claims.sessionId,
            tokenVersion: claims.tokenVersion,
            email: user.email,
            name: user.name,
        };
    } catch {
        return null;
    }
}

export async function resolveAuthenticatedUserId(
    accessToken?: string,
): Promise<number | null> {
    const principal = await resolveAuthenticatedPrincipal(accessToken);
    return principal?.userId ?? null;
}

export async function resolveCurrentSessionFamilyId(input: {
    accessToken?: string;
    rawRefreshToken?: string;
    userId: number;
}): Promise<string | null> {
    if (input.accessToken) {
        try {
            const claims = await verifyAccessToken(input.accessToken);
            if (parseAuthenticatedUserId(claims.sub) === input.userId) {
                return claims.sessionId;
            }
        } catch {
            // Fall through to refresh-token lookup.
        }
    }

    if (!input.rawRefreshToken) return null;

    const record = await findRefreshTokenFamily(
        hashRefreshToken(input.rawRefreshToken),
    );
    if (!record || record.userId !== input.userId) return null;
    return record.familyId;
}

export async function hasActiveAuthSessionFamily(
    userId: number,
    familyId: string,
): Promise<boolean> {
    return hasActiveSessionFamily(userId, familyId);
}

export async function logoutCurrentRefreshSession(
    rawRefreshToken?: string,
): Promise<{ userId: number; email: string } | null> {
    if (!rawRefreshToken) return null;
    return revokeCurrentRefreshToken(hashRefreshToken(rawRefreshToken));
}

export async function logoutAllRefreshSessions(userId: number): Promise<{
    userId: number;
    email: string;
} | null> {
    const user = await findAccountForLogout(userId);
    if (!user) return null;
    await revokeAllRefreshTokensForUser(userId);
    return { userId, email: user.email };
}

export async function listAuthSessions(input: {
    userId: number;
    currentFamilyId: string | null;
}): Promise<AuthSessionItem[]> {
    const sessions = await listActiveRefreshSessions(input.userId, new Date());
    return sessions.map((session) => ({
        ...session,
        isCurrent: input.currentFamilyId === session.familyId,
    }));
}

export async function revokeAuthSessionFamily(input: {
    userId: number;
    sessionId: string;
    now?: Date;
}): Promise<{ familyId: string; email: string } | null> {
    const tokenRecord = await findActiveOwnedRefreshToken(
        input.sessionId,
        input.userId,
        input.now ?? new Date(),
    );
    if (!tokenRecord) return null;

    await revokeRefreshFamily(tokenRecord.familyId, input.now ?? new Date());
    return tokenRecord;
}

export async function cleanupAuthRefreshSessions(
    retentionCutoff: Date,
): Promise<number> {
    return cleanupRefreshTokens(retentionCutoff);
}
