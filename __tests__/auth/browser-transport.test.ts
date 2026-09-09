import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    fetchWithRefresh,
    logoutHybridSession,
    refreshHybridSession,
} from "@/modules/auth/client";
import { API_ROUTES } from "@/lib/ssot/routes";

function okResponse(): Response {
    return new Response(null, { status: 200 });
}

function unauthorizedResponse(): Response {
    return new Response(null, { status: 401 });
}

describe("Auth browser refresh transport", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("refreshes once and retries a request after a 401", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(unauthorizedResponse())
            .mockResolvedValueOnce(okResponse())
            .mockResolvedValueOnce(okResponse());

        const response = await fetchWithRefresh("/api/notifications", {
            credentials: "include",
        });

        expect(response.status).toBe(200);
        expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
            "/api/notifications",
            API_ROUTES.auth.refresh,
            "/api/notifications",
        ]);
    });

    it("refreshes once and retries a HEAD read after a 401", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(unauthorizedResponse())
            .mockResolvedValueOnce(okResponse())
            .mockResolvedValueOnce(new Response(null, { status: 204 }));

        const response = await fetchWithRefresh("/api/notifications", {
            method: "HEAD",
            credentials: "include",
        });

        expect(response.status).toBe(204);
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "/api/notifications",
            expect.objectContaining({ method: "HEAD" }),
        );
    });

    it.each(["POST", "PUT", "PATCH", "DELETE"])(
        "refreshes but does not replay a %s mutation after a 401",
        async (method) => {
            const fetchMock = vi.spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(unauthorizedResponse())
                .mockResolvedValueOnce(okResponse());

            const body = JSON.stringify({ method });
            const response = await fetchWithRefresh("/api/mutation", {
                method,
                body,
                credentials: "include",
            });

            expect(response.status).toBe(401);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock).toHaveBeenNthCalledWith(
                1,
                "/api/mutation",
                expect.objectContaining({ method, body }),
            );
            expect(fetchMock).not.toHaveBeenNthCalledWith(
                3,
                "/api/mutation",
                expect.anything(),
            );
        },
    );

    it.each([
        ["JSON string", () => JSON.stringify({ value: 1 })],
        ["FormData", () => {
            const body = new FormData();
            body.append("value", "1");
            return body;
        }],
        ["URLSearchParams", () => new URLSearchParams({ value: "1" })],
        ["Blob", () => new Blob(["value"], { type: "text/plain" })],
        ["ArrayBuffer", () => new Uint8Array([1, 2, 3]).buffer],
        ["ReadableStream", () => new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array([1]));
                controller.close();
            },
        })],
    ] as const)("does not resend a %s mutation body", async (_label, createBody) => {
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(unauthorizedResponse())
            .mockResolvedValueOnce(okResponse());
        const body = createBody();

        const response = await fetchWithRefresh("/api/body", {
            method: "POST",
            body,
        });

        expect(response.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ body }));
    });

    it("does not retry the original request when refresh fails", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(unauthorizedResponse())
            .mockResolvedValueOnce(unauthorizedResponse());

        const response = await fetchWithRefresh("/api/notifications");

        expect(response.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([
        API_ROUTES.auth.refresh,
        API_ROUTES.auth.logout,
        API_ROUTES.auth.logoutAll,
    ])("does not recursively refresh Auth internal path %s", async (path) => {
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockResolvedValue(unauthorizedResponse());

        const response = await fetchWithRefresh(path, { method: "POST" });

        expect(response.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("shares one in-flight refresh across simultaneous 401 consumers", async () => {
        let resolveRefresh: ((response: Response) => void) | undefined;
        const refreshResponse = new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
        });
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockImplementation((input) => {
                if (String(input) === API_ROUTES.auth.refresh) {
                    return refreshResponse;
                }
                return Promise.resolve(unauthorizedResponse());
            });

        const firstRequest = fetchWithRefresh("/api/notifications");
        const secondRequest = fetchWithRefresh("/api/departments");
        await Promise.resolve();
        resolveRefresh?.(okResponse());

        const [firstResponse, secondResponse] = await Promise.all([
            firstRequest,
            secondRequest,
        ]);

        expect(firstResponse.status).toBe(401);
        expect(secondResponse.status).toBe(401);
        expect(fetchMock.mock.calls.filter(([input]) =>
            String(input) === API_ROUTES.auth.refresh,
        )).toHaveLength(1);
    });

    it("clears a browser session through the Auth logout endpoint", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

        await logoutHybridSession();

        expect(fetchMock).toHaveBeenCalledWith(
            API_ROUTES.auth.logout,
            expect.objectContaining({ method: "POST", credentials: "include" }),
        );
    });

    it("returns false when a direct refresh request fails", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

        await expect(refreshHybridSession()).resolves.toBe(false);
    });
});
