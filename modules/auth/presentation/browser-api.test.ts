import { afterEach, describe, expect, it, vi } from "vitest";

import { authApiRequest } from "./browser-api";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function firstRequestHeaders(fetchMock: ReturnType<typeof vi.spyOn>): Headers {
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    return new Headers(init?.headers);
}

describe("auth browser-api trusted-mutation header", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(["POST", "PUT", "PATCH", "DELETE"])("adds X-Requested-With for %s", async (method) => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
        await authApiRequest("/api/auth/example", { method, data: { value: 1 }, skipAuthRefresh: true });
        expect(firstRequestHeaders(fetchMock).get("X-Requested-With")).toBe("XMLHttpRequest");
    });

    it.each(["GET", "HEAD"])("omits X-Requested-With for %s", async (method) => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
        await authApiRequest("/api/auth/example", { method, skipAuthRefresh: true });
        expect(firstRequestHeaders(fetchMock).has("X-Requested-With")).toBe(false);
    });
});
