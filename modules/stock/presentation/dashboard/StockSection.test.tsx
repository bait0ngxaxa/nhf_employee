import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const capabilities = vi.hoisted(() => ({
    canReadCatalog: true,
    canReadOwnRequests: true,
    canReadAllRequests: true,
    canCreateRequests: true,
    canCancelOwnRequests: true,
    canCancelAnyRequests: true,
    canProcessRequests: true,
    canManageInventory: true,
    canExportReports: true,
}));

vi.mock("./context/StockProvider", () => ({
    StockProvider: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
}));
vi.mock("./context/StockContext", () => ({
    useStockDataContext: () => ({ stockCapabilities: capabilities }),
    useStockUIContext: () => ({ activeTab: "browse", setActiveTab: vi.fn() }),
}));
vi.mock("@/components/ui/section-shell", () => ({
    SectionShell: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/section-header", () => ({
    SectionHeader: ({ title, subtitle }: { readonly title: string; readonly subtitle: string }) => (
        <header><h1>{title}</h1><p>{subtitle}</p></header>
    ),
}));
vi.mock("@/components/ui/section-tabs", () => ({
    SectionTabs: ({ tabs }: { readonly tabs: readonly { readonly value: string; readonly label: string; readonly groupLabel?: string; readonly visible?: boolean }[] }) => (
        <nav>
            {tabs.filter((tab) => tab.visible !== false).map((tab) => (
                <span key={tab.value}>
                    {tab.groupLabel ? <span>{tab.groupLabel}</span> : null}
                    <button type="button">{tab.label}</button>
                </span>
            ))}
        </nav>
    ),
}));
vi.mock("./components/StockBrowse", () => ({ StockBrowse: () => null }));
vi.mock("./components/StockMyRequests", () => ({ StockMyRequests: () => null }));
vi.mock("./components/StockAdminInventory", () => ({ StockAdminInventory: () => null }));
vi.mock("./components/StockAdminRequests", () => ({ StockAdminRequests: () => null }));
vi.mock("./components/StockAdminReports", () => ({ StockAdminReports: () => null }));

import { StockSection } from "./StockSection";

describe("StockSection presentation", () => {
    it("keeps capability-driven tabs while removing system-role labels", () => {
        render(<StockSection />);

        expect(screen.getByRole("heading", { name: "NHF Stock" })).toBeInTheDocument();
        expect(screen.getByText("จัดการ")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "จัดการสต็อก" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "คำขอเบิก" })).toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ใช้งาน")).not.toBeInTheDocument();
    });
});
