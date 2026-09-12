import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getLiffConfiguredModules,
    getLiffHomeModules,
} from "@/modules/line";

const ROUTINE_READ_ALLOWED = {
    routineCapabilities: { canReadTasks: true },
};

const ROUTINE_READ_DENIED = {
    routineCapabilities: { canReadTasks: false },
};

describe("LIFF home module availability", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("enables Routine only when the feature and read capability are both available", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");

        expect(getLiffHomeModules(ROUTINE_READ_ALLOWED)).toEqual({
            stock: { enabled: true, status: "available" },
            leave: { enabled: false, status: "unavailable" },
            routine: { enabled: true, status: "available" },
        });
        expect(getLiffHomeModules(ROUTINE_READ_DENIED).routine).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });

    it("keeps Routine unavailable when the feature is disabled", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        expect(getLiffHomeModules(ROUTINE_READ_ALLOWED).routine).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });

    it("keeps non-Routine module configuration unchanged", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_STOCK", "false");

        expect(getLiffConfiguredModules().stock).toEqual({
            enabled: true,
            status: "available",
        });
        expect(getLiffConfiguredModules().leave).toEqual({
            enabled: true,
            status: "available",
        });
    });
});
