// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const {
    requireActiveWorkforceSessionMock,
    verifyLineIdTokenMock,
    linkLineAccountMock,
    findLineAccountLinkByLineUserIdMock,
    findActiveLiffWorkforceIdentityMock,
    issueLiffSessionMock,
    setLiffSessionCookieMock,
    clearLiffSessionCookieMock,
} = vi.hoisted(() => ({
    requireActiveWorkforceSessionMock: vi.fn(),
    verifyLineIdTokenMock: vi.fn(),
    linkLineAccountMock: vi.fn(),
    findLineAccountLinkByLineUserIdMock: vi.fn(),
    findActiveLiffWorkforceIdentityMock: vi.fn(),
    issueLiffSessionMock: vi.fn(),
    setLiffSessionCookieMock: vi.fn(),
    clearLiffSessionCookieMock: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: requireActiveWorkforceSessionMock,
}));

vi.mock("@/lib/auth/liff", () => ({
    findActiveLiffWorkforceIdentity: findActiveLiffWorkforceIdentityMock,
}));

vi.mock("@/lib/line/verify-id-token", () => ({
    verifyLineIdToken: verifyLineIdTokenMock,
}));

vi.mock("@/lib/line/account-link", () => ({
    LineAccountLinkConflictError: class LineAccountLinkConflictError extends Error {},
    linkLineAccount: linkLineAccountMock,
    findLineAccountLinkByLineUserId: findLineAccountLinkByLineUserIdMock,
}));

vi.mock("@/lib/line/liff-session", () => ({
    issueLiffSession: issueLiffSessionMock,
    setLiffSessionCookie: setLiffSessionCookieMock,
    clearLiffSessionCookie: clearLiffSessionCookieMock,
}));

import { POST as accountLinkRoute } from "@/app/api/line/account-link/route";
import { POST as liffSessionRoute } from "@/app/api/line/liff/session/route";
import { LineAccountLinkConflictError } from "@/lib/line/account-link";
import { LINE_AUTH_MAX_REQUEST_BYTES } from "@/lib/line/api";
import { LineIdentityVerificationError } from "@/lib/line/errors";

const ACTIVE_AUTH = {
    ok: true as const,
    session: {
        user: {
            id: "10",
            role: "USER",
            email: "employee@example.com",
            name: "Employee",
        },
    },
    user: {
        id: 10,
        role: "USER",
        email: "employee@example.com",
        name: "Employee",
    },
    employeeId: 20,
};

const LINKED_IDENTITY = {
    user: {
        id: 10,
        role: "USER",
        email: "employee@example.com",
        name: "Employee",
    },
    employeeId: 20,
};

const TRUSTED_HEADERS = {
    origin: "http://localhost",
    "x-requested-with": "XMLHttpRequest",
    "content-type": "application/json",
};

function requestWithBody(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
): NextRequest {
    return new NextRequest(url, {
        method: "POST",
        headers: { ...TRUSTED_HEADERS, ...headers },
        body: JSON.stringify(body),
    });
}

function requestWithRawBody(
    url: string,
    body: string,
    headers: Record<string, string> = {},
): NextRequest {
    return new NextRequest(url, {
        method: "POST",
        headers: { ...TRUSTED_HEADERS, ...headers },
        body,
    });
}

describe("LINE authentication routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireActiveWorkforceSessionMock.mockResolvedValue(ACTIVE_AUTH);
        verifyLineIdTokenMock.mockResolvedValue({ lineUserId: "line-a" });
        linkLineAccountMock.mockResolvedValue({ idempotent: false });
        findLineAccountLinkByLineUserIdMock.mockResolvedValue({ userId: 10 });
        findActiveLiffWorkforceIdentityMock.mockResolvedValue(LINKED_IDENTITY);
        issueLiffSessionMock.mockResolvedValue("signed-liff-session");
    });

    it("links the verified LINE identity to the active NHF session and issues a LIFF session", async () => {
        const response = await accountLinkRoute(
            requestWithBody(
                "http://localhost/api/line/account-link",
                { idToken: "line-id-token" },
            ),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ linked: true });
        expect(linkLineAccountMock).toHaveBeenCalledWith(10, "line-a");
        expect(issueLiffSessionMock).toHaveBeenCalledWith({
            userId: 10,
            employeeId: 20,
        });
        expect(setLiffSessionCookieMock).toHaveBeenCalledWith(
            expect.any(NextResponse),
            "signed-liff-session",
        );
    });

    it("rejects client-supplied identity fields instead of accepting them", async () => {
        const response = await accountLinkRoute(
            requestWithBody("http://localhost/api/line/account-link", {
                idToken: "line-id-token",
                userId: 999,
                employeeId: 999,
                lineUserId: "line-attacker",
            }),
        );

        expect(response.status).toBe(400);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
        expect(linkLineAccountMock).not.toHaveBeenCalled();
    });

    it("returns 401 when there is no active NHF session", async () => {
        requireActiveWorkforceSessionMock.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const response = await accountLinkRoute(
            requestWithBody("http://localhost/api/line/account-link", {
                idToken: "line-id-token",
            }),
        );

        expect(response.status).toBe(401);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
    });

    it.each([
        "inactive NHF user",
        "deleted NHF user",
        "inactive employee",
        "deleted employee",
    ])("does not allow linking for an %s", async (label) => {
        requireActiveWorkforceSessionMock.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: `${label} forbidden` }, { status: 403 }),
        });

        const response = await accountLinkRoute(
            requestWithBody("http://localhost/api/line/account-link", {
                idToken: "line-id-token",
            }),
        );

        expect(response.status).toBe(403);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
        expect(linkLineAccountMock).not.toHaveBeenCalled();
    });

    it("maps linking conflicts to 409", async () => {
        linkLineAccountMock.mockRejectedValueOnce(
            new LineAccountLinkConflictError(),
        );

        const response = await accountLinkRoute(
            requestWithBody("http://localhost/api/line/account-link", {
                idToken: "line-id-token",
            }),
        );

        expect(response.status).toBe(409);
    });

    it("maps an invalid LINE token to 401", async () => {
        verifyLineIdTokenMock.mockRejectedValueOnce(
            new LineIdentityVerificationError(
                "INVALID_TOKEN",
                "invalid token",
            ),
        );

        const response = await accountLinkRoute(
            requestWithBody("http://localhost/api/line/account-link", {
                idToken: "line-id-token",
            }),
        );

        expect(response.status).toBe(401);
        expect(linkLineAccountMock).not.toHaveBeenCalled();
    });

    it("returns linked:false for a valid but unlinked LINE identity", async () => {
        findLineAccountLinkByLineUserIdMock.mockResolvedValueOnce(null);

        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                { idToken: "line-id-token" },
                {},
            ),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ linked: false });
        expect(clearLiffSessionCookieMock).toHaveBeenCalledWith(
            expect.any(NextResponse),
        );
        expect(issueLiffSessionMock).not.toHaveBeenCalled();
    });

    it("accepts a valid bounded body and creates a LIFF session", async () => {
        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                { idToken: "line-id-token" },
                {},
            ),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ linked: true });
        expect(findActiveLiffWorkforceIdentityMock).toHaveBeenCalledWith(10);
        expect(issueLiffSessionMock).toHaveBeenCalledWith({
            userId: 10,
            employeeId: 20,
        });
        expect(setLiffSessionCookieMock).toHaveBeenCalledWith(
            expect.any(NextResponse),
            "signed-liff-session",
        );
    });

    it.each([
        ["missing Origin", { origin: "" }],
        ["untrusted Origin", { origin: "https://attacker.example" }],
        ["missing AJAX header", { "x-requested-with": "" }],
    ])("rejects a LIFF session mutation with %s", async (_label, headers) => {
        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                { idToken: "line-id-token" },
                headers,
            ),
        );

        expect(response.status).toBe(403);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
    });

    it("rejects a LIFF session request whose declared size exceeds the limit", async () => {
        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                { idToken: "line-id-token" },
                { "content-length": String(LINE_AUTH_MAX_REQUEST_BYTES + 1) },
            ),
        );

        expect(response.status).toBe(413);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
    });

    it("rejects an oversized body even when Content-Length is missing", async () => {
        const request = requestWithRawBody(
            "http://localhost/api/line/liff/session",
            JSON.stringify({ idToken: "x".repeat(LINE_AUTH_MAX_REQUEST_BYTES) }),
        );

        expect(request.headers.get("content-length")).toBeNull();
        const response = await liffSessionRoute(request);

        expect(response.status).toBe(413);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
    });

    it("maps malformed JSON to 400 without verifying a token", async () => {
        const response = await liffSessionRoute(
            requestWithRawBody(
                "http://localhost/api/line/liff/session",
                "{not-json",
            ),
        );

        expect(response.status).toBe(400);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
    });

    it.each([
        "inactive user",
        "deleted user",
        "inactive employee",
        "deleted employee",
    ])("returns 403 for a linked %s", async () => {
        findActiveLiffWorkforceIdentityMock.mockResolvedValueOnce(null);

        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                { idToken: "line-id-token" },
                {},
            ),
        );

        expect(response.status).toBe(403);
        expect(clearLiffSessionCookieMock).toHaveBeenCalledWith(
            expect.any(NextResponse),
        );
        expect(issueLiffSessionMock).not.toHaveBeenCalled();
    });

    it("maps invalid LIFF session input to 400", async () => {
        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                {
                    idToken: "line-id-token",
                    lineUserId: "client-supplied",
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                },
                {},
            ),
        );

        expect(response.status).toBe(400);
        expect(verifyLineIdTokenMock).not.toHaveBeenCalled();
    });

    it("maps LINE verification outages to 502", async () => {
        verifyLineIdTokenMock.mockRejectedValueOnce(
            new LineIdentityVerificationError(
                "UPSTREAM_ERROR",
                "unavailable",
            ),
        );

        const response = await liffSessionRoute(
            requestWithBody(
                "http://localhost/api/line/liff/session",
                { idToken: "line-id-token" },
                {},
            ),
        );

        expect(response.status).toBe(502);
    });
});
