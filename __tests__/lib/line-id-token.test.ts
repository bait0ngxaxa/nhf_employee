import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { getLineConfig } from "@/lib/line/config";
import {
    LineIdentityVerificationError,
    verifyLineIdToken,
} from "@/modules/line";

const fetchMock = vi.fn<typeof fetch>();

function mockVerificationResponse(
    body: unknown,
    init: ResponseInit = { status: 200 },
): void {
    fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
            headers: { "Content-Type": "application/json" },
            ...init,
        }),
    );
}

describe("NHFapp LINE ID token verification", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "nhfapp-channel-id");
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("returns the verified LINE user ID from sub", async () => {
        mockVerificationResponse({
            iss: "https://access.line.me",
            sub: "U1234567890abcdef1234567890abcdef",
            aud: "nhfapp-channel-id",
            exp: Math.floor(Date.now() / 1000) + 60,
        });

        await expect(verifyLineIdToken("id-token")).resolves.toEqual({
            lineUserId: "U1234567890abcdef1234567890abcdef",
        });
    });

    it("sends the configured channel ID as client_id", async () => {
        mockVerificationResponse({
            sub: "U123",
            aud: "nhfapp-channel-id",
            exp: Math.floor(Date.now() / 1000) + 60,
        });

        await verifyLineIdToken("token with spaces");

        const [url, request] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe("https://api.line.me/oauth2/v2.1/verify");
        expect(request?.method).toBe("POST");
        expect(request?.headers).toEqual({
            "Content-Type": "application/x-www-form-urlencoded",
        });

        const requestParams = new URLSearchParams(String(request?.body));
        expect(requestParams.get("id_token")).toBe("token with spaces");
        expect(requestParams.get("client_id")).toBe("nhfapp-channel-id");
    });

    it.each([
        ["", "empty token"],
        ["   ", "blank token"],
    ])("rejects an %s ID token", async (token) => {
        await expect(verifyLineIdToken(token)).rejects.toMatchObject({
            code: "INVALID_TOKEN",
            statusCode: 401,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a malformed successful response", async () => {
        mockVerificationResponse({ aud: "nhfapp-channel-id" });

        await expect(verifyLineIdToken("token")).rejects.toBeInstanceOf(
            LineIdentityVerificationError,
        );
    });

    it("rejects an expired successful response", async () => {
        mockVerificationResponse({
            sub: "U123",
            aud: "nhfapp-channel-id",
            exp: Math.floor(Date.now() / 1000) - 1,
        });

        await expect(verifyLineIdToken("token")).rejects.toMatchObject({
            code: "INVALID_TOKEN",
        });
    });

    it.each([
        [400, "INVALID_TOKEN", 401],
        [401, "INVALID_TOKEN", 401],
        [500, "UPSTREAM_ERROR", 502],
    ])("handles a LINE %s response", async (status, code, statusCode) => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status }));

        await expect(verifyLineIdToken("token")).rejects.toMatchObject({
            code,
            statusCode,
        });
    });

    it("rejects malformed JSON from LINE", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response("not-json", {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );

        await expect(verifyLineIdToken("token")).rejects.toMatchObject({
            code: "UPSTREAM_ERROR",
            statusCode: 502,
        });
    });

    it("handles a network failure without exposing upstream details", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network details"));

        await expect(verifyLineIdToken("token")).rejects.toMatchObject({
            code: "UPSTREAM_ERROR",
            statusCode: 502,
            message: "LINE ID token verification is unavailable",
        });
    });

    it("bounds the verification request with the shared outbound timeout signal", async () => {
        mockVerificationResponse({
            sub: "U123",
            aud: "nhfapp-channel-id",
            exp: Math.floor(Date.now() / 1000) + 60,
        });

        await expect(verifyLineIdToken("id-token")).resolves.toEqual({
            lineUserId: "U123",
        });

        const [, request] = fetchMock.mock.calls[0] ?? [];
        expect(request?.signal).toBeInstanceOf(AbortSignal);
        expect(request?.signal?.aborted).toBe(false);
    });

    it("maps a LINE verify timeout to the existing unavailable path and logs only a category", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        fetchMock.mockRejectedValueOnce(
            new DOMException("The operation was aborted due to timeout", "TimeoutError"),
        );

        await expect(verifyLineIdToken("secret-id-token")).rejects.toMatchObject({
            code: "UPSTREAM_ERROR",
            statusCode: 502,
            message: "LINE ID token verification is unavailable",
        });

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "LINE ID token verification request failed.",
            {
                provider: "line-login",
                operation: "verify-id-token",
                failureCategory: "timeout",
            },
        );
        expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("secret-id-token");
        consoleErrorSpy.mockRestore();
    });

    it("logs a non-timeout network failure as a separate sanitized category", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        fetchMock.mockRejectedValueOnce(new Error("network details"));

        await expect(verifyLineIdToken("secret-id-token")).rejects.toMatchObject({
            code: "UPSTREAM_ERROR",
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "LINE ID token verification request failed.",
            expect.objectContaining({ failureCategory: "network_failure" }),
        );
        const logged = JSON.stringify(consoleErrorSpy.mock.calls);
        expect(logged).not.toContain("secret-id-token");
        expect(logged).not.toContain("network details");
        consoleErrorSpy.mockRestore();
    });

    it("fails explicitly when the NHFapp LINE configuration is missing", () => {
        vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "   ");

        expect(() => getLineConfig()).toThrowError(
            expect.objectContaining({
                code: "MISCONFIGURED",
                statusCode: 500,
            }),
        );
    });

    it("rejects a response for a different LINE Login channel", async () => {
        mockVerificationResponse({
            sub: "U123",
            aud: "different-channel-id",
            exp: Math.floor(Date.now() / 1000) + 60,
        });

        await expect(verifyLineIdToken("token")).rejects.toMatchObject({
            code: "INVALID_TOKEN",
        });
    });

    it("rejects a response from an unexpected issuer", async () => {
        mockVerificationResponse({
            iss: "https://attacker.example",
            sub: "U123",
            aud: "nhfapp-channel-id",
            exp: Math.floor(Date.now() / 1000) + 60,
        });

        await expect(verifyLineIdToken("token")).rejects.toMatchObject({
            code: "INVALID_TOKEN",
        });
    });
});
