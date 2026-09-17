// @vitest-environment node

import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as StockModule from "@/modules/stock";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
    assertStockCapability: vi.fn(),
    saveLocalImageUpload: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession:
        mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/lib/uploads/local", () => ({
    saveLocalImageUpload: mocks.saveLocalImageUpload,
}));

vi.mock("@/modules/stock", async (importOriginal) => ({
    ...(await importOriginal<typeof StockModule>()),
    assertStockCapability: mocks.assertStockCapability,
}));

import { POST } from "@/app/api/uploads/image/route";
import { StockCapabilityDeniedError } from "@/modules/stock";

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

function buildRequest(scope: unknown, file: unknown): Request {
    const request = new Request("http://localhost/api/uploads/image", {
        method: "POST",
    });
    vi.spyOn(request, "formData").mockResolvedValue({
        get: (key: string) => key === "scope" ? scope : file,
    } as unknown as FormData);
    return request;
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
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue(AUTH);
        mocks.assertStockCapability.mockResolvedValue(undefined);
        mocks.saveLocalImageUpload.mockResolvedValue(UPLOAD);
    });

    it("authenticates before parsing multipart data or writing a file", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        const request = buildRequest("item", buildFile());

        const response = await POST(request);

        expect(response.status).toBe(401);
        expect(request.formData).not.toHaveBeenCalled();
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("checks stock capability before parsing multipart data or writing a file", async () => {
        mocks.assertStockCapability.mockRejectedValue(deniedCapability());
        const request = buildRequest("item", buildFile());

        const response = await POST(request);

        expect(response.status).toBe(403);
        expect(request.formData).not.toHaveBeenCalled();
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it.each([
        ["an invalid scope", "other", buildFile()],
        ["a missing file", "item", null],
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
        expect(mocks.requireActiveWorkforceOrAdminSession).toHaveBeenCalledTimes(2);
        expect(mocks.assertStockCapability).toHaveBeenCalledTimes(2);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("does not let an Admin session bypass the central inventory capability", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue(ADMIN_AUTH);
        mocks.assertStockCapability.mockRejectedValue(deniedCapability());

        const response = await POST(buildRequest("item", buildFile()));

        expect(response.status).toBe(403);
        expect(mocks.saveLocalImageUpload).not.toHaveBeenCalled();
    });

    it("writes only after both authorization checks pass", async () => {
        const file = buildFile();
        const response = await POST(buildRequest("variant", file));

        expect(response.status).toBe(200);
        expect(mocks.requireActiveWorkforceOrAdminSession).toHaveBeenCalledTimes(2);
        expect(mocks.assertStockCapability).toHaveBeenCalledTimes(2);
        expect(mocks.saveLocalImageUpload).toHaveBeenCalledWith({
            scope: "variant",
            file,
        });
    });
});
