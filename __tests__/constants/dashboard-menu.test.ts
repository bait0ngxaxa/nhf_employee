import { afterEach, describe, expect, it } from "vitest";
import {
    DASHBOARD_MENU_ITEMS,
    getDashboardPageLabel,
    getMenuTheme,
    getAvailableMenuGroups,
} from "@/constants/dashboard";
import { isDashboardTabEnabled } from "@/lib/ssot/features";
import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";

const originalRoutineFlag = process.env.NEXT_PUBLIC_FEATURE_ROUTINE;

const routineCapabilities = {
    canReadTasks: true,
    canCreateTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canReadOccurrences: false,
    canOverrideOccurrences: false,
    canReassignOccurrences: false,
    canChangeOccurrenceDueDate: false,
    canManageImports: false,
} satisfies RoutinePresentationCapabilities;

const stockCapabilities = {
    canReadCatalog: true,
    canReadOwnRequests: true,
    canReadAllRequests: false,
    canCreateRequests: false,
    canCancelOwnRequests: false,
    canCancelAnyRequests: false,
    canProcessRequests: false,
    canManageInventory: false,
    canExportReports: false,
} satisfies StockPresentationCapabilities;

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
            getAvailableMenuGroups(true, routineCapabilities)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
    });

    it("shows NHF Routine and its theme when its feature flag is enabled", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        expect(isDashboardTabEnabled("routine")).toBe(true);
        expect(
            getAvailableMenuGroups(false, routineCapabilities)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("routine");
        expect(getMenuTheme("routine").text).toBe("text-teal-700");
        expect(getDashboardPageLabel("routine")).toBe("NHF Routine");
    });

    it("hides NHF Routine when its read capability is false or unavailable", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        expect(
            getAvailableMenuGroups(true, {
                ...routineCapabilities,
                canReadTasks: false,
            })
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
        expect(
            getAvailableMenuGroups(true)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
    });

    it("preserves non-Routine role filtering while applying Routine capability filtering", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        const adminMenuIds = getAvailableMenuGroups(true, routineCapabilities)
            .flatMap((group) => group.items.map((item) => item.id));
        const userMenuIds = getAvailableMenuGroups(false, routineCapabilities)
            .flatMap((group) => group.items.map((item) => item.id));

        expect(adminMenuIds).toContain("routine");
        expect(userMenuIds).toContain("routine");
        expect(adminMenuIds).toContain("email-request");
        expect(userMenuIds).not.toContain("email-request");
    });

    it("shows Stock only when a Stock presentation surface is usable", () => {
        expect(
            getAvailableMenuGroups(false, undefined, stockCapabilities)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("stock");
        expect(
            getAvailableMenuGroups(true)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("stock");
    });

    it("lets an explicit non-admin report capability expose Stock", () => {
        expect(
            getAvailableMenuGroups(false, undefined, {
                ...stockCapabilities,
                canReadCatalog: false,
                canReadOwnRequests: false,
                canExportReports: true,
            })
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("stock");
    });
});
