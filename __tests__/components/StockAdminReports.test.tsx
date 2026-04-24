import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockAdminReports } from "@/components/dashboard/stock/StockAdminReports";
import { apiGet } from "@/lib/api-client";
import { triggerDownload } from "@/lib/helpers/download";

vi.mock("@/lib/api-client", () => ({
    apiGet: vi.fn(),
}));

vi.mock("@/lib/helpers/download", () => ({
    triggerDownload: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
    },
}));

describe("StockAdminReports", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses a newly returned year for meta and export", async () => {
        vi.mocked(apiGet)
            .mockResolvedValueOnce({
                success: true,
                data: { years: [2031, 2030] },
                status: 200,
                requestId: "req-years",
            } as never)
            .mockResolvedValueOnce({
                success: true,
                data: { year: 2026, count: 3, maxRows: 5000 },
                status: 200,
                requestId: "req-meta-current-year",
            } as never)
            .mockResolvedValueOnce({
                success: true,
                data: { year: 2031, count: 8, maxRows: 5000 },
                status: 200,
                requestId: "req-meta",
            } as never);

        render(<StockAdminReports />);

        await waitFor(() => {
            expect(apiGet).toHaveBeenCalledWith("/api/stock/reports/export?yearsOnly=1");
            expect(apiGet).toHaveBeenCalledWith(
                "/api/stock/reports/export?metaOnly=1&year=2026",
            );
            expect(apiGet).toHaveBeenCalledWith(
                "/api/stock/reports/export?metaOnly=1&year=2031",
            );
        });

        expect(screen.getByRole("combobox", { name: "เลือกปีรีพอร์ตวัสดุ" })).toHaveTextContent(
            "2031",
        );
        await waitFor(() => {
            expect(screen.getByText("8 รายการ")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "ดาวน์โหลด CSV" }),
            ).toBeEnabled();
        });

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลด CSV" }),
        );

        expect(triggerDownload).toHaveBeenCalledWith(
            "/api/stock/reports/export?format=csv&year=2031",
        );
    });
});
