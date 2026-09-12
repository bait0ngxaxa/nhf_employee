// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUserProjection: vi.fn(),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/app/dashboard/stock/StockRouteContent", () => ({
    StockRouteContent: () => null,
}));

import StockDashboardPage from "@/app/dashboard/stock/page";

const stockUser = {
    id: "41",
    role: "USER",
    email: "account@test.com",
    stockCapabilities: {
        canReadCatalog: true,
        canReadOwnRequests: true,
        canReadAllRequests: false,
        canCreateRequests: true,
        canCancelOwnRequests: true,
        canCancelAnyRequests: false,
        canProcessRequests: false,
        canManageInventory: false,
        canExportReports: false,
    },
};

describe("Stock Dashboard route access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUserProjection.mockResolvedValue(stockUser);
    });

    it("preserves normal login behavior for an unauthenticated actor", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(StockDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("redirects an authenticated actor without a usable Stock surface", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...stockUser,
            stockCapabilities: {
                ...stockUser.stockCapabilities,
                canReadCatalog: false,
                canReadOwnRequests: false,
            },
        });

        await expect(StockDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("renders for an explicitly authorized non-admin Stock actor", async () => {
        const page = await StockDashboardPage();

        expect(page).toBeTruthy();
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.getCurrentUserProjection).toHaveBeenCalledTimes(1);
    });

    it("allows a report-only presentation surface without requiring ADMIN", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...stockUser,
            role: "USER",
            stockCapabilities: {
                ...stockUser.stockCapabilities,
                canReadCatalog: false,
                canReadOwnRequests: false,
                canCreateRequests: false,
                canCancelOwnRequests: false,
                canExportReports: true,
            },
        });

        await expect(StockDashboardPage()).resolves.toBeTruthy();
    });
});
