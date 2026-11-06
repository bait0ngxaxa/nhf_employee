import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";

const props = { availableYears: [2031], selectedYear: 2031, onYearChange: vi.fn(), onExport: vi.fn(), isExporting: false };

describe("YearlyReportExportPanel", () => {
    it("defaults to Excel and starts the supplied export", () => {
        render(<YearlyReportExportPanel {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "ดาวน์โหลด Excel" }));
        expect(props.onExport).toHaveBeenCalledTimes(1);
    });
    it.each(["inline", "card"] as const)("preserves explicit labels and busy state in %s layout", (layout) => {
        render(<YearlyReportExportPanel {...props} layout={layout} exportLabel="รายงานเฉพาะทีม" isExporting />);
        const button = screen.getByRole("button", { name: "รายงานเฉพาะทีม" });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("combobox")).toBeDisabled();
    });
    it("respects disabled metadata validation", () => {
        render(<YearlyReportExportPanel {...props} disabled />);
        expect(screen.getByRole("button", { name: "ดาวน์โหลด Excel" })).toBeDisabled();
    });
});
