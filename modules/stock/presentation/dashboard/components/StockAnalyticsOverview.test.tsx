import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StockAnalyticsResponse } from "../../../domain/analytics";
import { StockAnalyticsOverview } from "./StockAnalyticsOverview";

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }));
vi.mock("./useStockAnalytics", () => ({ useStockAnalytics: (params: URLSearchParams) => mocks.query(params) }));
vi.mock("./StockAnalyticsCharts", () => ({ StockPopularityChart: () => <div>กราฟ Top 10</div>, StockDistributionChart: ({ title }: { title: string }) => <h3>{title}</h3> }));

const data: StockAnalyticsResponse = {
    filters: { year: 2026, fromMonth: 1, toMonth: 12, metric: "frequency" },
    period: { start: "2025-12-31T17:00:00Z", end: "2026-12-31T17:00:00Z", timezone: "Asia/Bangkok" },
    kpis: { issuedRequests: 12, issuedLines: 24, pendingRequests: 3, attentionVariants: 1 },
    topMaterials: [{ id: 1, name: "กระดาษ", sku: "PAPER", category: "สำนักงาน", requestCount: 12, lineCount: 24, quantities: [{ unit: "รีม", quantity: 20 }, { unit: "กล่อง", quantity: 2 }], available: [{ unit: "รีม", quantity: 0 }], health: { healthy: 0, low: 0, out: 1 } }],
    categories: [{ id: 1, name: "สำนักงาน", lines: 24, percentage: 100 }],
    stockHealth: { healthy: 0, low: 0, out: 1 },
    lowStock: [{ id: 1, itemId: 1, name: "กระดาษ", sku: "PAPER-A4", attributes: "ขนาด: A4", unit: "รีม", quantity: 2, reserved: 2, available: 0, minimum: 1, status: "out" }], lowStockTotal: 1,
    options: { categories: [{ id: 1, name: "สำนักงาน" }], units: ["รีม", "กล่อง"] }, detail: null,
    freshness: { generatedAt: "2026-11-06T00:00:00Z", snapshotScope: "current-all-active-variants" },
};

describe("Stock analytics overview", () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.query.mockReturnValue({ data, isLoading: false, isValidating: false, mutate: mocks.mutate }); });
    it("shows real metrics, unit breakdowns and inventory navigation", () => {
        const inventory = vi.fn();
        render(<StockAnalyticsOverview onInventory={inventory} />);
        expect(screen.getByText("จำนวนคำขอที่จ่ายแล้ว")).toBeInTheDocument();
        expect(screen.getByText("20 รีม / 2 กล่อง")).toBeInTheDocument();
        expect(screen.getByText("คำขอรอจ่าย · ปัจจุบัน")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "จัดการสต็อก" }));
        expect(inventory).toHaveBeenCalledWith("PAPER-A4");
        fireEvent.click(screen.getByRole("button", { name: "รีเฟรชข้อมูล" }));
        expect(mocks.mutate).toHaveBeenCalledOnce();
    });
    it("applies period and project filters and resets them", () => {
        render(<StockAnalyticsOverview />);
        fireEvent.change(screen.getByLabelText("รหัสโครงการ (ตรงทั้งหมด)"), { target: { value: "PROJECT-A" } });
        fireEvent.change(screen.getByLabelText("เดือนเริ่มต้น"), { target: { value: "2" } });
        fireEvent.submit(screen.getByRole("form", { name: "ตัวกรองการจ่ายวัสดุย้อนหลัง" }));
        expect(mocks.query.mock.lastCall?.[0].get("projectCode")).toBe("PROJECT-A");
        expect(mocks.query.mock.lastCall?.[0].get("fromMonth")).toBe("2");
        fireEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
        expect(mocks.query.mock.lastCall?.[0].has("projectCode")).toBe(false);
    });
    it("opens variant drill-down from the material detail table", () => {
        render(<StockAnalyticsOverview />);
        fireEvent.click(screen.getByRole("button", { name: "กระดาษ" }));
        expect(mocks.query.mock.lastCall?.[0].get("itemId")).toBe("1");
    });
    it("provides retryable error and loading states without stale metrics", () => {
        mocks.query.mockReturnValue({ data, error: new Error("กรุณาลองใหม่"), isLoading: false, mutate: mocks.mutate });
        const { rerender } = render(<StockAnalyticsOverview />);
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.queryByText("จำนวนคำขอที่จ่ายแล้ว")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
        expect(mocks.mutate).toHaveBeenCalled();
        mocks.query.mockReturnValue({ data: undefined, isLoading: true, mutate: mocks.mutate });
        rerender(<StockAnalyticsOverview />);
        expect(screen.queryByText("จำนวนคำขอที่จ่ายแล้ว")).not.toBeInTheDocument();
    });
    it("shows an empty historical state while retaining current stock alerts", () => {
        mocks.query.mockReturnValue({ data: { ...data, topMaterials: [], categories: [], kpis: { ...data.kpis, issuedRequests: 0, issuedLines: 0 } }, mutate: mocks.mutate });
        render(<StockAnalyticsOverview />);
        expect(screen.getByText(/ไม่มีข้อมูลการจ่ายในช่วงที่เลือก/)).toBeInTheDocument();
        expect(screen.getByText("PAPER-A4 · ขนาด: A4")).toBeInTheDocument();
    });
});
