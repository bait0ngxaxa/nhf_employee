import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost } from "@/lib/client/api-client";
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

        expect(result).toMatchObject({ success: false, status: 401 });
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

        expect(result).toMatchObject({ success: false, status: 401 });
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

        expect(result).toMatchObject({ success: false, status: 401 });
        expect(recover).toHaveBeenCalledOnce();
        expect(rebootstrap).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        unregister();
    });
});
