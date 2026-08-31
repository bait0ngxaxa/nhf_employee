import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost, apiRequest } from "@/lib/client/api-client";
import {
    LIFF_API_REQUEST_OPTIONS,
    registerLiffSessionRecovery,
} from "@/lib/client/liff";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

describe("central LIFF session recovery", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("re-establishes the session and replays one safe GET", async () => {
        const recover = vi.fn().mockResolvedValue(true);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
            .mockResolvedValueOnce(jsonResponse({ value: 42 }));

        await expect(
            apiGet<{ value: number }>(
                "/api/line/stock/items",
                LIFF_API_REQUEST_OPTIONS,
            ),
        ).resolves.toMatchObject({
            success: true,
            data: { value: 42 },
        });

        expect(recover).toHaveBeenCalledOnce();
        expect(rebootstrap).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        unregister();
    });

    it("never replays a mutation after a session recovery", async () => {
        const recover = vi.fn().mockResolvedValue(true);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

        const result = await apiPost(
            "/api/line/leave/decision",
            { leaveId: "leave-1", action: "APPROVE" },
            LIFF_API_REQUEST_OPTIONS,
        );

        expect(result).toMatchObject({
            success: false,
            status: 401,
            unauthorizedRecovery: { recovered: true, replayed: false },
        });
        expect(recover).toHaveBeenCalledOnce();
        expect(rebootstrap).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledOnce();
        unregister();
    });

    it("rebootstraps once when recovery cannot restore the session", async () => {
        const recover = vi.fn().mockResolvedValue(false);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

        const result = await apiGet(
            "/api/line/routine/summary",
            LIFF_API_REQUEST_OPTIONS,
        );

        expect(result).toMatchObject({
            success: false,
            status: 401,
            unauthorizedRecovery: { recovered: false, replayed: false },
        });
        expect(rebootstrap).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledOnce();
        unregister();
    });

    it("does not invoke recovery again for a failed replay", async () => {
        const recover = vi.fn().mockResolvedValue(true);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
            .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

        const result = await apiGet(
            "/api/line/leave/me",
            LIFF_API_REQUEST_OPTIONS,
        );

        expect(result).toMatchObject({
            success: false,
            status: 401,
            unauthorizedRecovery: { recovered: true, replayed: true },
        });
        expect(recover).toHaveBeenCalledOnce();
        expect(rebootstrap).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        unregister();
    });

    it("re-establishes the session and replays one safe HEAD", async () => {
        const recover = vi.fn().mockResolvedValue(true);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }));

        const result = await apiRequest("/api/line/leave/me", {
            ...LIFF_API_REQUEST_OPTIONS,
            method: "HEAD",
            retryCount: 0,
        });

        expect(result).toMatchObject({ success: true, status: 204 });
        expect(recover).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        unregister();
    });

    it("deduplicates concurrent GET recovery and replays each read once", async () => {
        let resolveRecovery: ((recovered: boolean) => void) | undefined;
        const recoveryPromise = new Promise<boolean>((resolve) => {
            resolveRecovery = resolve;
        });
        const recover = vi.fn(() => recoveryPromise);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        let fetchCount = 0;
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
            async () => {
                fetchCount += 1;
                return fetchCount <= 3
                    ? jsonResponse({ error: "Unauthorized" }, 401)
                    : jsonResponse({ value: fetchCount });
            },
        );

        const pendingReads = Promise.all([
            apiGet("/api/line/stock/items", {
                ...LIFF_API_REQUEST_OPTIONS,
                retryCount: 0,
            }),
            apiGet("/api/line/leave/me", {
                ...LIFF_API_REQUEST_OPTIONS,
                retryCount: 0,
            }),
            apiGet("/api/line/routine/summary", {
                ...LIFF_API_REQUEST_OPTIONS,
                retryCount: 0,
            }),
        ]);

        await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
        resolveRecovery?.(true);
        const results = await pendingReads;

        expect(results.every((result) => result.success)).toBe(true);
        expect(recover).toHaveBeenCalledOnce();
        expect(rebootstrap).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(6);
        unregister();
    });

    it("keeps rebootstrap one-shot across multiple failed requests", async () => {
        const recover = vi.fn().mockResolvedValue(false);
        const rebootstrap = vi.fn();
        const unregister = registerLiffSessionRecovery(recover, rebootstrap);
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({ error: "Unauthorized" }, 401),
        );

        await Promise.all([
            apiGet("/api/line/stock/items", {
                ...LIFF_API_REQUEST_OPTIONS,
                retryCount: 0,
            }),
            apiGet("/api/line/leave/me", {
                ...LIFF_API_REQUEST_OPTIONS,
                retryCount: 0,
            }),
        ]);

        expect(recover).toHaveBeenCalledOnce();
        expect(rebootstrap).toHaveBeenCalledOnce();
        unregister();
    });
});
