// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as refreshRoute } from "@/app/api/auth/refresh/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as logoutAllRoute } from "@/app/api/auth/logout-all/route";
import { POST as revokeSessionRoute } from "@/app/api/auth/sessions/revoke/route";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/auth/hybrid/constants";

const {
    auditCreateMock,
    logoutAllRefreshSessionsMock,
    logoutCurrentRefreshSessionMock,
    refreshHybridSessionMock,
    resolveAuthenticatedUserIdMock,
    resolveCurrentSessionFamilyIdMock,
    revokeAuthSessionFamilyMock,
    state,
} = vi.hoisted(() => ({
    auditCreateMock: vi.fn(),
    logoutAllRefreshSessionsMock: vi.fn(),
    logoutCurrentRefreshSessionMock: vi.fn(),
    refreshHybridSessionMock: vi.fn(),
    resolveAuthenticatedUserIdMock: vi.fn(),
    resolveCurrentSessionFamilyIdMock: vi.fn(),
    revokeAuthSessionFamilyMock: vi.fn(),
    state: {
        refreshFamilyContained: false,
        currentSessionRevoked: false,
        selectedSessionRevoked: false,
        allSessionsRevoked: false,
    },
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        auditLog: { create: auditCreateMock },
    },
}));

vi.mock("@/modules/auth", () => ({
    getAuditFamilyCorrelation: (familyId: string) => familyId.slice(0, 16),
    logoutAllRefreshSessions: logoutAllRefreshSessionsMock,
    logoutCurrentRefreshSession: logoutCurrentRefreshSessionMock,
    refreshHybridSession: refreshHybridSessionMock,
    resolveAuthenticatedUserId: resolveAuthenticatedUserIdMock,
    resolveCurrentSessionFamilyId: resolveCurrentSessionFamilyIdMock,
    revokeAuthSessionFamily: revokeAuthSessionFamilyMock,
}));

const REQUEST_HEADERS = {
    origin: "http://localhost",
    "x-requested-with": "XMLHttpRequest",
    "cf-connecting-ip": "203.0.113.80",
    "x-forwarded-for": "198.51.100.80",
    "user-agent": "audit-failure-test-agent",
};

function request(
    url: string,
    options: { cookie?: string; body?: string } = {},
): NextRequest {
    return new NextRequest(url, {
        method: "POST",
        headers: {
            ...REQUEST_HEADERS,
            ...(options.body ? { "content-type": "application/json" } : {}),
            ...(options.cookie ? { cookie: options.cookie } : {}),
        },
        body: options.body,
    });
}

describe("Audit persistence failure containment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.refreshFamilyContained = false;
        state.currentSessionRevoked = false;
        state.selectedSessionRevoked = false;
        state.allSessionsRevoked = false;
        auditCreateMock.mockRejectedValue(new Error("audit sink unavailable"));
        refreshHybridSessionMock.mockImplementation(async () => {
            state.refreshFamilyContained = true;
            return {
                status: "unauthorized",
                securityEvent: {
                    userId: 1,
                    email: "user@example.com",
                    familyId: "0123456789abcdef0123456789abcdef",
                    reason: "refresh_token_reuse_or_expired",
                    ipAddress: REQUEST_HEADERS["cf-connecting-ip"],
                    userAgent: REQUEST_HEADERS["user-agent"],
                },
            };
        });
        logoutCurrentRefreshSessionMock.mockImplementation(async () => {
            state.currentSessionRevoked = true;
            return { userId: 1, email: "user@example.com" };
        });
        resolveAuthenticatedUserIdMock.mockResolvedValue(1);
        logoutAllRefreshSessionsMock.mockImplementation(async () => {
            state.allSessionsRevoked = true;
            return { userId: 1, email: "user@example.com" };
        });
        revokeAuthSessionFamilyMock.mockImplementation(async () => {
            state.selectedSessionRevoked = true;
            return {
                familyId: "fedcba98765432100123456789abcdef",
                email: "user@example.com",
            };
        });
        resolveCurrentSessionFamilyIdMock.mockResolvedValue(
            "fedcba98765432100123456789abcdef",
        );
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps a confirmed refresh reuse unauthorized and contained", async () => {
        const response = await refreshRoute(
            request("http://localhost/api/auth/refresh", {
                cookie: `${HYBRID_REFRESH_COOKIE_NAME}=raw-refresh-secret`,
            }),
        );

        expect(response.status).toBe(401);
        expect(state.refreshFamilyContained).toBe(true);
        expect(auditCreateMock).toHaveBeenCalledTimes(1);
    });

    it("keeps logout successful after the session has been revoked", async () => {
        const response = await logoutRoute(
            request("http://localhost/api/auth/logout", {
                cookie: `${HYBRID_REFRESH_COOKIE_NAME}=raw-refresh-secret`,
            }),
        );

        expect(response.status).toBe(200);
        expect(state.currentSessionRevoked).toBe(true);
        expect(auditCreateMock).toHaveBeenCalledTimes(1);
    });

    it("keeps logout-all and selected-session revoke contained", async () => {
        const logoutAllResponse = await logoutAllRoute(
            request("http://localhost/api/auth/logout-all", {
                cookie: `${HYBRID_ACCESS_COOKIE_NAME}=access-token`,
            }),
        );
        const revokeResponse = await revokeSessionRoute(
            request("http://localhost/api/auth/sessions/revoke", {
                cookie: [
                    `${HYBRID_ACCESS_COOKIE_NAME}=access-token`,
                    `${HYBRID_REFRESH_COOKIE_NAME}=raw-refresh-secret`,
                ].join("; "),
                body: JSON.stringify({
                    sessionId: "fedcba98765432100123456789abcdef",
                }),
            }),
        );

        expect(logoutAllResponse.status).toBe(200);
        expect(revokeResponse.status).toBe(200);
        expect(state.allSessionsRevoked).toBe(true);
        expect(state.selectedSessionRevoked).toBe(true);
        expect(auditCreateMock).toHaveBeenCalledTimes(2);
    });

    it("logs failure context without logging the raw refresh secret", async () => {
        await refreshRoute(
            request("http://localhost/api/auth/refresh", {
                cookie: `${HYBRID_REFRESH_COOKIE_NAME}=raw-refresh-secret`,
            }),
        );

        const errorCalls = vi.mocked(console.error).mock.calls;
        expect(errorCalls).toContainEqual([
            "[AuditLog] Failed to create audit log:",
            expect.objectContaining({
                event: "audit_persistence_failed",
                action: "LOGIN_FAILED",
                entityType: "User",
                entityId: 1,
            }),
        ]);
        expect(JSON.stringify(errorCalls)).not.toContain("raw-refresh-secret");
    });
});
