import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as StockModule from "@/modules/stock";
import { GET as stockReportsExportRoute } from "@/app/api/stock/reports/export/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/ssot/permissions";
import {
    createStockBalanceReportXlsxResponse,
    getStockBalanceReportMeta,
    createStockRequestReportXlsxResponse,
    getStockRequestReportMeta,
    getStockRequestReportYears,
} from "@/modules/stock";

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/modules/stock", async () => {
    const actual = await vi.importActual<typeof StockModule>(
        "@/modules/stock",
    );
    return {
        ...actual,
        getStockBalanceReportMeta: vi.fn(),
        createStockBalanceReportXlsxResponse: vi.fn(),
        getStockRequestReportYears: vi.fn(),
        getStockRequestReportMeta: vi.fn(),
        createStockRequestReportXlsxResponse: vi.fn(),
    };
});

describe("GET /api/stock/reports/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", email: "admin@test.com", role: "ADMIN" },
        } as never);
        vi.mocked(isAdminRole).mockReturnValue(true);
    });

    it("returns available years including a newly added year", async () => {
        vi.mocked(getStockRequestReportYears).mockResolvedValue([2031, 2030, 2029]);

        const request = new NextRequest(
            "http://localhost/api/stock/reports/export?yearsOnly=1",
        );
        const response = await stockReportsExportRoute(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.years).toEqual([2031, 2030, 2029]);
    });

    it("returns meta for the selected future year", async () => {
        vi.mocked(getStockRequestReportMeta).mockResolvedValue({
            count: 12,
            maxRows: 5000,
        });

        const request = new NextRequest(
            "http://localhost/api/stock/reports/export?metaOnly=1&year=2031",
        );
        const response = await stockReportsExportRoute(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(getStockRequestReportMeta).toHaveBeenCalledWith(2031);
        expect(data).toEqual({
            year: 2031,
            count: 12,
            maxRows: 5000,
        });
    });

    it("exports current stock balances without a database audit write", async () => {
        vi.mocked(getStockBalanceReportMeta).mockResolvedValue({
            count: 15,
            maxRows: 5000,
        });
        vi.mocked(createStockBalanceReportXlsxResponse).mockResolvedValue(
            new Response("xlsx-data", { status: 200 }),
        );

        const request = new NextRequest(
            "http://localhost/api/stock/reports/export?format=xlsx&reportType=balances",
        );
        const response = await stockReportsExportRoute(request);

        expect(response.status).toBe(200);
        expect(createStockBalanceReportXlsxResponse).toHaveBeenCalledTimes(1);
    });

    it("exports the selected year without a database audit write", async () => {
        vi.mocked(getStockRequestReportMeta).mockResolvedValue({
            count: 3,
            maxRows: 5000,
        });
        vi.mocked(createStockRequestReportXlsxResponse).mockResolvedValue(
            new Response("xlsx-data", { status: 200 }),
        );

        const request = new NextRequest(
            "http://localhost/api/stock/reports/export?format=xlsx&year=2031",
        );
        const response = await stockReportsExportRoute(request);

        expect(response.status).toBe(200);
        expect(createStockRequestReportXlsxResponse).toHaveBeenCalledWith(2031);
    });
});
