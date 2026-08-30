import { afterEach, describe, expect, it, vi } from "vitest";

import { getLiffHomeModules } from "@/lib/line/liff-home";

describe("LIFF home module availability", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("uses the existing Leave and Routine feature flags", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");

        expect(getLiffHomeModules()).toEqual({
            stock: { enabled: true, status: "coming-soon" },
            leave: { enabled: false, status: "unavailable" },
            routine: { enabled: true, status: "available" },
        });
    });

    it("keeps stock available without inventing a second stock flag", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_STOCK", "false");

        expect(getLiffHomeModules().stock).toEqual({
            enabled: true,
            status: "coming-soon",
        });
    });
});
