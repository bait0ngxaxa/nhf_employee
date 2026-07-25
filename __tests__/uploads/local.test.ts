// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const ONE_PIXEL_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
);

describe("stock local upload compatibility", () => {
    it("still transforms and cleans up a stock image upload", async () => {
        const temporaryRoot = await mkdtemp(
            path.join(os.tmpdir(), "stock-upload-test-"),
        );
        const previousWorkingDirectory = process.cwd();
        process.chdir(temporaryRoot);

        try {
            vi.resetModules();
            const {
                deleteLocalUploadByUrl,
                saveLocalImageUpload,
            } = await import("@/lib/uploads/local");
            const result = await saveLocalImageUpload({
                scope: "item",
                file: new File([ONE_PIXEL_PNG], "stock.png", {
                    type: "image/png",
                }),
            });

            expect(result.url).toMatch(/^\/api\/uploads\/stock\/items\/\d{4}\/\d{2}\/[^/]+\.webp$/);
            expect(result.contentType).toBe("image/webp");
            expect(result.width).toBe(1);
            expect(result.height).toBe(1);
            await deleteLocalUploadByUrl(result.url);
        } finally {
            process.chdir(previousWorkingDirectory);
            await rm(temporaryRoot, { recursive: true, force: true });
        }
    });
});
