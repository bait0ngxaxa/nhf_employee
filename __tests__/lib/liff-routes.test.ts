import { describe, expect, it } from "vitest";

import { APP_ROUTES, isLiffAppPath } from "@/lib/ssot/routes";

describe("LIFF route SSOT", () => {
    it("exposes the unified LIFF module routes", () => {
        expect(APP_ROUTES.line).toMatchObject({
            root: "/liff",
            stock: "/liff/stock",
            leave: "/liff/leave",
            routine: "/liff/routine",
            it: "/liff/it",
        });
        expect(APP_ROUTES.line.itTicket(42)).toBe("/liff/it/42");
    });

    it("accepts the root, module routes, and future child routes", () => {
        expect(isLiffAppPath("/liff")).toBe(true);
        expect(isLiffAppPath("/liff/stock")).toBe(true);
        expect(isLiffAppPath("/liff/leave")).toBe(true);
        expect(isLiffAppPath("/liff/routine")).toBe(true);
        expect(isLiffAppPath("/liff/routine/task")).toBe(true);
        expect(isLiffAppPath("/liff/it")).toBe(true);
        expect(isLiffAppPath("/liff/it/42")).toBe(true);
        expect(isLiffAppPath("/dashboard")).toBe(false);
        expect(isLiffAppPath(null)).toBe(false);
    });
});
