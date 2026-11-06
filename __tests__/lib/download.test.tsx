import { afterEach, describe, expect, it, vi } from "vitest";

import { triggerDownload } from "@/lib/helpers/download";

afterEach(() => vi.restoreAllMocks());

describe("triggerDownload", () => {
    it.each([
        { url: "/api/employees/export", filename: undefined },
        { url: "blob:employee-export", filename: "รายชื่อพนักงาน_ค้นหา-สมชาย.xlsx" },
    ])("downloads $url and removes the temporary link", ({ url, filename }) => {
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.getAttribute("href")).toBe(url);
            expect(this.download).toBe(filename ?? "");
            expect(document.body.contains(this)).toBe(true);
        });
        triggerDownload(url, filename);
        expect(click).toHaveBeenCalledOnce();
        expect(document.querySelector(`a[href="${url}"]`)).toBeNull();
    });

    it("removes the link even if the browser rejects the click", () => {
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
            throw new Error("Download failed");
        });
        expect(() => triggerDownload("blob:failed", "รายชื่อพนักงาน.xlsx")).toThrow("Download failed");
        expect(document.querySelector('a[href="blob:failed"]')).toBeNull();
    });
});
