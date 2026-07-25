// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/uploads/[...path]/route";
import { readLocalUpload } from "@/lib/uploads/local";

vi.mock("@/lib/uploads/local", () => ({
    readLocalUpload: vi.fn(),
}));

function routeContext(segments: string[]): {
    params: Promise<{ path: string[] }>;
} {
    return { params: Promise.resolve({ path: segments }) };
}

describe("GET /api/uploads/[...path]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(readLocalUpload).mockResolvedValue(Buffer.from("stock"));
    });

    it("continues serving managed stock uploads", async () => {
        const response = await GET(
            new Request("http://localhost/api/uploads/stock/items/2030/05/item.webp"),
            routeContext(["stock", "items", "2030", "05", "item.webp"]),
        );

        expect(response.status).toBe(200);
        expect(readLocalUpload).toHaveBeenCalledWith([
            "stock",
            "items",
            "2030",
            "05",
            "item.webp",
        ]);
    });

    it("never exposes private leave files through the stock route", async () => {
        const response = await GET(
            new Request("http://localhost/api/uploads/private/leave/request/file.webp"),
            routeContext(["private", "leave", "request", "file.webp"]),
        );

        expect(response.status).toBe(404);
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it("blocks case variants of the private directory on case-insensitive filesystems", async () => {
        const response = await GET(
            new Request("http://localhost/api/uploads/PRIVATE/leave/request/file.webp"),
            routeContext(["PRIVATE", "leave", "request", "file.webp"]),
        );

        expect(response.status).toBe(404);
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it("rejects traversal while preserving existing in-root stock paths", async () => {
        const traversalResponse = await GET(
            new Request("http://localhost/api/uploads/blocked"),
            routeContext(["..", "private", "leave", "request", "file.webp"]),
        );
        const legacyStockResponse = await GET(
            new Request("http://localhost/api/uploads/blocked"),
            routeContext(["stock", "legacy", "old-file.webp"]),
        );

        expect(traversalResponse.status).toBe(404);
        expect(legacyStockResponse.status).toBe(200);
        expect(readLocalUpload).toHaveBeenCalledWith([
            "stock",
            "legacy",
            "old-file.webp",
        ]);
    });
});
