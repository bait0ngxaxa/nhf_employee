import { describe, expect, it } from "vitest";

import {
    isSafeInternalPath,
    resolveSafeInternalPath,
} from "@/lib/auth/return-path";

describe("safe login return paths", () => {
    it("accepts a same-origin internal LIFF path", () => {
        const path = "/liff/routine?link=1&loginReturn=1";

        expect(isSafeInternalPath(path)).toBe(true);
        expect(resolveSafeInternalPath(path)).toBe(path);
    });

    it.each([
        "https://attacker.example",
        "//attacker.example",
        "javascript:alert(1)",
        "/\\attacker.example",
        "/liff/routine\\attacker",
    ])("rejects unsafe return path %s", (path) => {
        expect(isSafeInternalPath(path)).toBe(false);
        expect(resolveSafeInternalPath(path)).toBe("/dashboard");
    });
});
