// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/uploads/[...path]/route";
import { readLocalUpload } from "@/lib/uploads/local";

vi.mock("@/lib/uploads/local", () => ({
    readLocalUpload: vi.fn(),
}));

const ITEM_FILE = "item-1777777777777-0123456789ab.webp";
const VARIANT_FILE = "variant-1777777777777-abcdef012345.webp";

function routeContext(segments: string[]): {
    params: Promise<{ path: string[] }>;
} {
    return { params: Promise.resolve({ path: segments }) };
}

async function get(segments: string[]): Promise<Response> {
    return GET(
        new Request(`http://localhost/api/uploads/${segments.join("/")}`),
        routeContext(segments),
    );
}

describe("GET /api/uploads/[...path]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(readLocalUpload).mockResolvedValue(Buffer.from("stock"));
    });

    it("continues serving managed stock item uploads", async () => {
        const segments = ["stock", "items", "2030", "05", ITEM_FILE];
        const response = await get(segments);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/webp");
        expect(readLocalUpload).toHaveBeenCalledWith(segments);
    });

    it("continues serving managed stock variant uploads", async () => {
        const segments = ["stock", "variants", "2026", "12", VARIANT_FILE];
        const response = await get(segments);

        expect(response.status).toBe(200);
        expect(readLocalUpload).toHaveBeenCalledWith(segments);
    });

    it("never exposes private leave files through the stock route", async () => {
        const response = await get(["private", "leave", "request", "file.webp"]);

        expect(response.status).toBe(404);
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it("blocks case variants of the private directory on case-insensitive filesystems", async () => {
        const response = await get(["PRIVATE", "leave", "request", "file.webp"]);

        expect(response.status).toBe(404);
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it("never exposes private paths shaped like a stock upload", async () => {
        const response = await get(["private", "items", "2030", "05", ITEM_FILE]);

        expect(response.status).toBe(404);
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it.each([
        ["parent traversal", ["..", "private", "leave", "request", "file.webp"]],
        ["traversal inside stock", ["stock", "items", "..", "..", "private"]],
        ["encoded separator in the file name", ["stock", "items", "2030", "05", `..%2F${ITEM_FILE}`]],
        ["backslash separator", ["stock", "items", "2030", "05", `..\\${ITEM_FILE}`]],
        ["dot segment as the year", ["stock", "items", ".", "05", ITEM_FILE]],
        ["NUL byte", ["stock", "items", "2030", "05", `${ITEM_FILE}\0`]],
    ])("rejects %s", async (_label, segments) => {
        const response = await get(segments);

        expect(response.status).toBe(404);
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it.each([
        ["a non-webp file under stock", ["stock", "items", "2030", "05", "item-1777777777777-0123456789ab.png"]],
        ["an uppercase extension", ["stock", "items", "2030", "05", "item-1777777777777-0123456789ab.WEBP"]],
        ["a file name not written by the uploader", ["stock", "items", "2030", "05", "item.webp"]],
        ["a scope/file-name mismatch", ["stock", "items", "2030", "05", VARIANT_FILE]],
        ["an unknown stock folder", ["stock", "legacy", "old-file.webp"]],
        ["an unknown stock folder with a dated shape", ["stock", "legacy", "2030", "05", ITEM_FILE]],
        ["an invalid month", ["stock", "items", "2030", "13", ITEM_FILE]],
        ["a non-numeric year", ["stock", "items", "20x0", "05", ITEM_FILE]],
        ["an extra nested segment", ["stock", "items", "2030", "05", "extra", ITEM_FILE]],
        ["a missing date segment", ["stock", "items", "2030", ITEM_FILE]],
        ["a top-level folder other than stock", ["it", "items", "2030", "05", ITEM_FILE]],
        ["an empty path", []],
    ])("returns 404 for %s", async (_label, segments) => {
        const response = await get(segments);

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "ไม่พบไฟล์" });
        expect(readLocalUpload).not.toHaveBeenCalled();
    });

    it("returns the same 404 when an allowlisted file does not exist", async () => {
        vi.mocked(readLocalUpload).mockRejectedValue(new Error("ENOENT: /srv/app/.uploads/x"));

        const response = await get(["stock", "items", "2030", "05", ITEM_FILE]);

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "ไม่พบไฟล์" });
    });
});
