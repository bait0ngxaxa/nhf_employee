// @vitest-environment node

import { type NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as StockModule from "@/modules/stock";
import type * as LocalUploadModule from "@/lib/uploads/local";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceSession: vi.fn(),
    assertStockCapability: vi.fn(),
    saveLocalImageUpload: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession:
        mocks.requireActiveWorkforceSession,
}));

vi.mock("@/lib/uploads/local", async (importOriginal) => ({
    ...(await importOriginal<typeof LocalUploadModule>()),
    saveLocalImageUpload: mocks.saveLocalImageUpload,
}));

vi.mock("@/modules/stock", async (importOriginal) => ({
    ...(await importOriginal<typeof StockModule>()),
    assertStockCapability: mocks.assertStockCapability,
}));

import { POST } from "@/app/api/uploads/image/route";
import {
    AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES,
    PRE_AUTH_IP_RATE_LIMIT_POLICIES,
    resetMutationRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { IMAGE_UPLOAD_MAX_REQUEST_BYTES } from "@/lib/ssot/uploads";
import { ImageUploadValidationError } from "@/lib/uploads/local";
import { StockCapabilityDeniedError } from "@/modules/stock";
import { trustedNextRequest } from "@/__tests__/helpers/trusted-mutation";

const AUTH = {
    ok: true as const,
    user: { id: 7, email: "user@example.com", role: "USER" },
    employeeId: 21,
};

const ADMIN_AUTH = {
    ok: true as const,
    user: { id: 1, email: "admin@example.com", role: "ADMIN" },
};

const UPLOAD = {
    url: "/api/uploads/stock/items/2026/09/item.webp",
    relativePath: "stock/items/2026/09/item.webp",
    contentType: "image/webp" as const,
    size: 12,
    width: 1,
    height: 1,
};

function buildFile(): File {
    return new File(["image"], "item.png", { type: "image/png" });
}

function buildRequest(
    scope: string | null,
    file: File | string | null,
    init: { headers?: Record<string, string>; ip?: string } = {},
): NextRequest {
    const formData = new FormData();
    if (scope !== null) formData.set("scope", scope);
    if (file !== null) formData.set("file", file);
    return trustedNextRequest("http://localhost/api/uploads/image", {
        method: "POST",
        headers: { "cf-connecting-ip": init.ip ?? "203.0.113.10", ...init.headers },
        body: formData,
    });
}

function buildRawRequest(
    body: BodyInit,
    headers: Record<string, string>,
): NextRequest {
    return trustedNextRequest("http://localhost/api/uploads/image", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.11", ...headers },
        body,
    });
}

function deniedCapability(): StockCapabilityDeniedError {
    return new StockCapabilityDeniedError(
        "stock.inventory.manage",
        "NO_APPLICABLE_GRANT",
    );
}

describe("POST /api/uploads/image", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMutationRateLimit();
        mocks.requireActiveWorkforceSession.mockResolvedValue(AUTH);
        mocks.assertStockCapability.mockResolvedValue(undefined);
        mocks.saveLocalImageUpload.mockResolvedValue(UPLOAD);
    });

    it("authenticates before parsing multipart data or writing a file", async () => {
        mocks.requireActiveWorkforceSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        const request = buildRequest("item", buildFile());

        const response = await POST(request);

        expect(response.status).toBe(401);
        expect(request.bodyUsed).toBe(false);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("checks stock capability before parsing multipart data or writing a file", async () => {
        mocks.assertStockCapability.mockRejectedValue(deniedCapability());
        const request = buildRequest("item", buildFile());

        const response = await POST(request);

        expect(response.status).toBe(403);
        expect(request.bodyUsed).toBe(false);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it.each([
        ["an invalid scope", "other", buildFile()],
        ["a missing file", "item", null],
        ["a string file field", "item", "not-a-file"],
    ])("rejects %s without writing", async (_label, scope, file) => {
        const request = buildRequest(scope, file);

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
        expect(mocks.assertStockCapability).toHaveBeenCalledOnce();
    });

    it("revalidates current authorization immediately before the filesystem side effect", async () => {
        mocks.assertStockCapability
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(deniedCapability());

        const response = await POST(buildRequest("item", buildFile()));

        expect(response.status).toBe(403);
        expect(mocks.requireActiveWorkforceSession).toHaveBeenCalledTimes(2);
        expect(mocks.assertStockCapability).toHaveBeenCalledTimes(2);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("does not let an Admin session bypass the central inventory capability", async () => {
        mocks.requireActiveWorkforceSession.mockResolvedValue(ADMIN_AUTH);
        mocks.assertStockCapability.mockRejectedValue(deniedCapability());

        const response = await POST(buildRequest("item", buildFile()));

        expect(response.status).toBe(403);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("writes only after both authorization checks pass", async () => {
        const response = await POST(buildRequest("variant", buildFile()));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ upload: UPLOAD });
        expect(mocks.requireActiveWorkforceSession).toHaveBeenCalledTimes(2);
        expect(mocks.assertStockCapability).toHaveBeenCalledTimes(2);
        expect(mocks.saveLocalImageUpload).toHaveBeenCalledWith({
            scope: "variant",
            file: expect.any(File),
        });
        const saved = mocks.saveLocalImageUpload.mock.calls[0]?.[0] as { file: File };
        expect(saved.file.name).toBe("item.png");
        expect(saved.file.type).toBe("image/png");
    });

    it("returns 413 from Content-Length before authentication or reading the body", async () => {
        const request = buildRequest("item", buildFile(), {
            headers: { "content-length": String(IMAGE_UPLOAD_MAX_REQUEST_BYTES + 1) },
        });
        const formDataSpy = vi.spyOn(request, "formData");

        const response = await POST(request);

        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toEqual({ error: "คำขอมีขนาดใหญ่เกินไป" });
        expect(formDataSpy).not.toHaveBeenCalled();
        expect(request.bodyUsed).toBe(false);
        expect(mocks.requireActiveWorkforceSession).not.toHaveBeenCalled();
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("returns 413 from the bounded stream when Content-Length is absent", async () => {
        const boundary = "----bounded-image-test";
        const oversized = new Uint8Array(IMAGE_UPLOAD_MAX_REQUEST_BYTES + 1);
        const request = buildRawRequest(oversized, {
            "content-type": `multipart/form-data; boundary=${boundary}`,
        });
        const formDataSpy = vi.spyOn(request, "formData");

        const response = await POST(request);

        expect(response.status).toBe(413);
        expect(formDataSpy).not.toHaveBeenCalled();
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("rejects a malformed multipart body with 400", async () => {
        const response = await POST(buildRawRequest("not multipart", {
            "content-type": "multipart/form-data; boundary=missing",
        }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it.each([
        ["รองรับเฉพาะไฟล์ JPG, PNG และ WEBP"],
        ["ไฟล์รูปต้องมีขนาดไม่เกิน 8MB"],
    ])("returns the intentional validation message %s byte-for-byte", async (message) => {
        mocks.saveLocalImageUpload.mockRejectedValue(new ImageUploadValidationError(message));

        const response = await POST(buildRequest("item", buildFile()));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: message });
    });

    it("never returns sharp/internal error text to the client", async () => {
        const internal = new Error(
            "Input buffer has corrupt header: VipsJpeg: /srv/app/.uploads/stock/items/x.webp",
        );
        mocks.saveLocalImageUpload.mockRejectedValue(internal);
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            const response = await POST(buildRequest("item", buildFile()));
            const body = await response.json() as unknown;

            expect(response.status).toBe(500);
            expect(body).toEqual({ error: "อัปโหลดรูปไม่สำเร็จ" });
            expect(JSON.stringify(body)).not.toMatch(/Vips|corrupt|\.uploads|\/srv/);
            expect(errorLog).toHaveBeenCalledWith("Error saving image upload", {
                errorType: "Error",
                scope: "item",
            });
            expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/Vips|corrupt|\.uploads|\/srv/);
        } finally {
            errorLog.mockRestore();
        }
    });

    it("rate limits authenticated uploads per user", async () => {
        const policy = AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES["stock-image-upload"];
        for (let attempt = 0; attempt < policy.maxRequests; attempt += 1) {
            const response = await POST(buildRequest("item", buildFile()));
            expect(response.status).toBe(200);
        }

        const request = buildRequest("item", buildFile());
        const limited = await POST(request);

        expect(limited.status).toBe(429);
        expect(request.bodyUsed).toBe(false);
        expect(mocks.saveLocalImageUpload).toHaveBeenCalledTimes(policy.maxRequests);
    });

    it("rate limits by client IP before authentication", async () => {
        const policy = PRE_AUTH_IP_RATE_LIMIT_POLICIES["stock-image-upload"];
        mocks.requireActiveWorkforceSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        for (let attempt = 0; attempt < policy.maxRequests; attempt += 1) {
            await POST(buildRequest("item", buildFile(), { ip: "198.51.100.9" }));
        }
        mocks.requireActiveWorkforceSession.mockClear();

        const limited = await POST(buildRequest("item", buildFile(), { ip: "198.51.100.9" }));

        expect(limited.status).toBe(429);
        expect(mocks.requireActiveWorkforceSession).not.toHaveBeenCalled();
    });
});
