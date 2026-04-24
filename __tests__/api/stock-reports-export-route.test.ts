import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import { GET as stockReportsExportRoute } from "@/app/api/stock/reports/export/route";
import { getApiAuthSession } from "@/lib/server-auth";
import { isAdminRole } from "@/lib/ssot/permissions";
import {
    createStockRequestReportCsvResponse,
    getStockRequestReportMeta,
    getStockRequestReportYears,
} from "@/lib/services/stock/report-export";
import { logDataExport } from "@/lib/audit";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/server-auth", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/lib/services/stock/report-export", () => ({
    getStockRequestReportYears: vi.fn(),
    getStockRequestReportMeta: vi.fn(),
    createStockRequestReportCsvResponse: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
    logDataExport: vi.fn(),
}));

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

    it("exports the selected year and logs audit", async () => {
        vi.mocked(getStockRequestReportMeta).mockResolvedValue({
            count: 3,
            maxRows: 5000,
        });
        vi.mocked(createStockRequestReportCsvResponse).mockResolvedValue(
            new Response("csv-data", { status: 200 }),
        );

        const request = new NextRequest(
            "http://localhost/api/stock/reports/export?format=csv&year=2031",
        );
        const response = await stockReportsExportRoute(request);

        expect(response.status).toBe(200);
        expect(createStockRequestReportCsvResponse).toHaveBeenCalledWith(2031);
        expect(logDataExport).toHaveBeenCalledWith(
            1,
            "admin@test.com",
            expect.objectContaining({
                metadata: expect.objectContaining({
                    entityType: "StockRequest",
                    recordCount: 3,
                    filters: { year: 2031 },
                }),
            }),
        );
    });
});
