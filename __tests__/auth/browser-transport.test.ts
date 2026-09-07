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
