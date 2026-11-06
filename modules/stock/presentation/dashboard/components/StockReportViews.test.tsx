import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StockAdminReports } from "./StockAdminReports";

vi.mock("./StockAnalyticsOverview", () => ({ StockAnalyticsOverview: () => <h2>analytics overview</h2> }));
vi.mock("./StockLegacyReports", () => ({ StockLegacyReports: () => <h2>original Excel reports</h2> }));

describe("Stock report view permissions", () => {
    beforeEach(() => {
        vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
        Element.prototype.scrollIntoView = vi.fn();
    });
    afterEach(() => vi.unstubAllGlobals());
    it("defaults to overview with both grants and offers only legacy Excel on the second tab", () => {
        render(<StockAdminReports canReadReports canExportReports />);
        expect(screen.getByRole("heading", { name: "analytics overview" })).toBeVisible();
        fireEvent.keyDown(screen.getByRole("tab", { name: "รายงาน Excel" }), { key: "Enter" });
        expect(screen.getByRole("heading", { name: "original Excel reports" })).toBeVisible();
        expect(screen.queryByRole("heading", { name: "analytics overview" })).not.toBeInTheDocument();
    });

    it("shows only overview for read-only users", () => {
        render(<StockAdminReports canReadReports canExportReports={false} />);
        expect(screen.getByRole("heading", { name: "analytics overview" })).toBeVisible();
        expect(screen.queryByRole("tab", { name: "รายงาน Excel" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "original Excel reports" })).not.toBeInTheDocument();
    });

    it("shows original Excel reports directly for export-only users", () => {
        render(<StockAdminReports canReadReports={false} canExportReports />);
        expect(screen.getByRole("heading", { name: "original Excel reports" })).toBeVisible();
        expect(screen.queryByRole("heading", { name: "analytics overview" })).not.toBeInTheDocument();
    });

    it("renders no report content without either grant", () => {
        const { container } = render(<StockAdminReports canReadReports={false} canExportReports={false} />);
        expect(container).toBeEmptyDOMElement();
    });
});
