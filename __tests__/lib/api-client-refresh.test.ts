import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost, apiRequest } from "@/lib/client/api-client";

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

    it.each([
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
    ] as const)("does not implicitly replay a %s after refresh", async (method) => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "content-type": "application/json" },
                }),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));

        const result = await apiRequest("/api/protected-mutation", {
            method,
            data: { value: 1 },
        });

        expect(result).toMatchObject({ success: false, status: 401 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/protected-mutation");
        expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/refresh");
    });

    it.each([
        [401, "รายละเอียดการตรวจบัญชีภายใน", /เข้าสู่ระบบอีกครั้ง/],
        [503, "เชื่อมต่อฐานข้อมูลภายในไม่ได้", /ลองใหม่/],
        [409, "คำขอได้รับการอนุมัติแล้ว", /ได้รับการอนุมัติแล้ว/],
        [422, "ยอดคงเหลือไม่เพียงพอ", /ยอดคงเหลือไม่เพียงพอ/],
    ] as const)("keeps the status and safely presents HTTP %s", async (status, rawMessage, expected) => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: rawMessage }), {
                status,
                headers: { "content-type": "application/json" },
            }),
        );

        const result = await apiRequest("/api/example", {
            method: "POST",
            skipAuthRefresh: true,
            retryCount: 0,
        });

        expect(result).toMatchObject({
            success: false,
            status,
            errorThai: expect.stringMatching(expected),
        });
        if (status === 401 || status >= 500) {
            expect(result).not.toMatchObject({ errorThai: rawMessage });
        }
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("sends FormData without forcing JSON content-type", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ upload: { url: "/uploads/item/test.webp" } }), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );
        const formData = new FormData();

        formData.append("scope", "item");
        formData.append(
            "file",
            new Blob(["image"], { type: "image/webp" }),
            "test.webp",
        );

        const result = await apiPost<{ upload: { url: string } }>(
            "/api/uploads/image",
            formData,
        );

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = new Headers(requestInit.headers);

        expect(requestInit.body).toBe(formData);
        expect(headers.get("Content-Type")).toBeNull();
        expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    });
});
