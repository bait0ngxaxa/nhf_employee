import { afterEach, describe, expect, it } from "vitest";
import {
    DASHBOARD_MENU_ITEMS,
    getDashboardPageLabel,
    getMenuTheme,
    getAvailableMenuGroups,
} from "@/constants/dashboard";
import { isDashboardTabEnabled } from "@/lib/ssot/features";

const originalRoutineFlag = process.env.NEXT_PUBLIC_FEATURE_ROUTINE;

afterEach(() => {
    if (originalRoutineFlag === undefined) {
        delete process.env.NEXT_PUBLIC_FEATURE_ROUTINE;
    } else {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = originalRoutineFlag;
    }
});

describe("dashboard menu", () => {
    it("keeps CSV import route available but hides it from dashboard menus", () => {
        expect(
            DASHBOARD_MENU_ITEMS.some((item) => item.id === "import-employee"),
        ).toBe(true);

        const adminMenuIds = getAvailableMenuGroups(true).flatMap((group) =>
            group.items.map((item) => item.id),
        );
        const userMenuIds = getAvailableMenuGroups(false).flatMap((group) =>
            group.items.map((item) => item.id),
        );

        expect(adminMenuIds).not.toContain("import-employee");
        expect(userMenuIds).not.toContain("import-employee");
    });

    it("hides NHF Routine when its feature flag is disabled", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "false";

        expect(isDashboardTabEnabled("routine")).toBe(false);
        expect(
            getAvailableMenuGroups(true)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
    });

    it("shows NHF Routine and its theme when its feature flag is enabled", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        expect(isDashboardTabEnabled("routine")).toBe(true);
        expect(
            getAvailableMenuGroups(false)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("routine");
        expect(getMenuTheme("routine").text).toBe("text-teal-700");
        expect(getDashboardPageLabel("routine")).toBe("NHF Routine");
    });
});
