import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";

import { GET as leaveExportRoute } from "@/app/api/leave/export/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import {
    createLeaveReportXlsxResponse,
    getLeaveReportMeta,
    getLeaveReportYears,
} from "@/lib/services/leave/report-export";
import { logDataExport } from "@/lib/server/audit";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/services/leave/get-employee-id", () => ({
    getEmployeeIdFromUserId: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/services/leave/report-export", () => ({
    getLeaveReportYears: vi.fn(),
    getLeaveReportMeta: vi.fn(),
    createLeaveReportXlsxResponse: vi.fn(),
}));

vi.mock("@/lib/server/audit", () => ({
    logDataExport: vi.fn(),
}));

describe("GET /api/leave/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "1",
                role: "USER",
                email: "manager@example.com",
                name: "Manager",
            },
        });
        vi.mocked(getEmployeeIdFromUserId).mockResolvedValue(200);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: { id: 200, status: "ACTIVE", deletedAt: null },
        } as never);
    });

    it("returns available years for the current team", async () => {
        vi.mocked(getLeaveReportYears).mockResolvedValue([2031, 2030]);

        const response = await leaveExportRoute(
            new NextRequest("http://localhost/api/leave/export?yearsOnly=1"),
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(getLeaveReportYears).toHaveBeenCalledWith(200);
        expect(data.years).toEqual([2031, 2030]);
    });

    it("returns employee and request counts for report meta", async () => {
        vi.mocked(getLeaveReportMeta).mockResolvedValue({
            year: 2031,
            employeeCount: 2,
            requestCount: 0,
            maxRows: 3000,
        });

        const response = await leaveExportRoute(
            new NextRequest("http://localhost/api/leave/export?metaOnly=1&year=2031"),
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            year: 2031,
            employeeCount: 2,
            requestCount: 0,
            maxRows: 3000,
        });
    });

    it("exports xlsx and logs audit metadata", async () => {
        vi.mocked(getLeaveReportMeta).mockResolvedValue({
            year: 2031,
            employeeCount: 2,
            requestCount: 5,
            maxRows: 3000,
        });
        vi.mocked(createLeaveReportXlsxResponse).mockResolvedValue(
            new Response("xlsx-data", {
                headers: {
                    "Content-Type":
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
            }),
        );

        const response = await leaveExportRoute(
            new NextRequest("http://localhost/api/leave/export?format=xlsx&year=2031"),
        );

        expect(response.status).toBe(200);
        expect(createLeaveReportXlsxResponse).toHaveBeenCalledWith(200, 2031);
        expect(logDataExport).toHaveBeenCalledWith(
            "LeaveRequest",
            1,
            "manager@example.com",
            expect.objectContaining({
                metadata: expect.objectContaining({
                    recordCount: 5,
                    employeeCount: 2,
                    filters: { year: 2031, format: "xlsx" },
                }),
            }),
        );
    });
});
