import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api-client";

describe("api-client refresh retry", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("retries original request once after successful refresh", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "content-type": "application/json" },
                }),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ value: 42 }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            );

        const result = await apiGet<{ value: number }>("/api/protected");

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.value).toBe(42);
        }

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "/api/protected",
            expect.objectContaining({ credentials: "include", method: "GET" }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "/api/auth/refresh",
            expect.objectContaining({ method: "POST", credentials: "include" }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "/api/protected",
            expect.objectContaining({ credentials: "include", method: "GET" }),
        );
    });
});
