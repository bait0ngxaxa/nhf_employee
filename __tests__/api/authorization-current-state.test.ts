import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import ExcelJS from "exceljs";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { EmployeeCapabilityDeniedError } from "@/modules/employee";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    employeeFiltersSafeParse: vi.fn(),
    createEmployeeExport: vi.fn(),
    assertEmployeeCapability: vi.fn(),
    assertEmployeeCapabilityScope: vi.fn(),
    buildEmployeeAuthorizationContext: vi.fn(),
    logDataExport: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: mocks.requireApiSession,
}));

vi.mock("@/modules/employee", () => ({
    EmployeeCapabilityDeniedError: class EmployeeCapabilityDeniedError extends Error {
        readonly statusCode = 403;
    },
    assertEmployeeCapability: mocks.assertEmployeeCapability,
    assertEmployeeCapabilityScope: mocks.assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationContext: mocks.buildEmployeeAuthorizationContext,
    createEmployeeExport: mocks.createEmployeeExport,
    employeeFiltersSchema: {
        safeParse: mocks.employeeFiltersSafeParse,
    },
}));

vi.mock("@/lib/server/audit", () => ({
    logDataExport: mocks.logDataExport,
}));

import { GET as getEmployeeExport } from "@/app/api/employees/export/route";
import { POST as logAuditExport } from "@/app/api/audit-logs/export/route";

async function createExportResponse(): Promise<Response> {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("รายชื่อพนักงาน");
    return createXlsxDownloadResponse("รายชื่อพนักงาน.xlsx", workbook);
}

describe("Phase 0 authorization current-state characterization", () => {
    beforeEach(async () => {
        vi.resetAllMocks();
        mocks.requireApiSession.mockResolvedValue({
            ok: true,
            session: {
                user: {
                    id: "5",
                    role: "USER",
                    email: "user@example.com",
                },
            },
            user: {
                id: 5,
                role: "USER",
                email: "user@example.com",
            },
        });
        mocks.employeeFiltersSafeParse.mockReturnValue({
            success: true,
            data: { page: 1, limit: 10 },
        });
        mocks.buildEmployeeAuthorizationContext.mockImplementation((user) => ({
            authorizationActor: {
                userId: user.id,
                employeeId: null,
                systemRole: user.role,
                channel: "DASHBOARD",
            },
        }));
        mocks.assertEmployeeCapability.mockResolvedValue({
            scopes: ["ALL"],
        });
        mocks.assertEmployeeCapabilityScope.mockImplementation(
            (authorization) => authorization,
        );
        mocks.createEmployeeExport.mockResolvedValue({
            status: "ready",
            recordCount: 0,
            auditFilters: { search: null, status: null },
            response: await createExportResponse(),
        });
        mocks.logDataExport.mockResolvedValue(undefined);
    });

    it("preserves current USER access to the Employee export route", async () => {
        const response = await getEmployeeExport(
            new NextRequest("http://localhost/api/employees/export"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await response.arrayBuffer());
        expect(workbook.worksheets[0].name).toBe("รายชื่อพนักงาน");
        expect(mocks.assertEmployeeCapabilityScope).toHaveBeenCalledWith(expect.any(Object), "ALL");
        expect(mocks.assertEmployeeCapability).toHaveBeenCalledWith(
            expect.objectContaining({
                authorizationActor: expect.objectContaining({
                    userId: 5,
                    systemRole: "USER",
                    channel: "DASHBOARD",
                }),
            }),
            "employee.export",
        );
        expect(mocks.createEmployeeExport).toHaveBeenCalledWith({ page: 1, limit: 10 });
        expect(mocks.logDataExport).toHaveBeenCalledWith(
            "Employee",
            5,
            "user@example.com",
            expect.any(Object),
        );
    });

    it("rejects unauthenticated export without preparing a file or audit", async () => {
        mocks.requireApiSession.mockResolvedValue({ ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) });
        const response = await getEmployeeExport(new NextRequest("http://localhost/api/employees/export"));
        expect(response.status).toBe(401);
        expect(mocks.createEmployeeExport).not.toHaveBeenCalled();
        expect(mocks.logDataExport).not.toHaveBeenCalled();
    });

    it.each(["capability", "scope"])("rejects denied export %s without preparing a file or audit", async (boundary) => {
        const error = new EmployeeCapabilityDeniedError("employee.export", "NO_APPLICABLE_GRANT");
        if (boundary === "capability") mocks.assertEmployeeCapability.mockRejectedValue(error);
        else mocks.assertEmployeeCapabilityScope.mockImplementation(() => { throw error; });
        const response = await getEmployeeExport(new NextRequest("http://localhost/api/employees/export"));
        expect(response.status).toBe(403);
        expect(mocks.createEmployeeExport).not.toHaveBeenCalled();
        expect(mocks.logDataExport).not.toHaveBeenCalled();
    });

    it("rejects invalid status filters without export or audit", async () => {
        mocks.employeeFiltersSafeParse.mockReturnValue({
            success: false,
            error: { flatten: () => ({ fieldErrors: { status: ["Invalid status"] } }) },
        });
        const response = await getEmployeeExport(new NextRequest("http://localhost/api/employees/export?status=INVALID"));
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ details: { status: ["Invalid status"] } });
        expect(mocks.createEmployeeExport).not.toHaveBeenCalled();
        expect(mocks.logDataExport).not.toHaveBeenCalled();
    });

    it("preserves filter forwarding and audit metadata", async () => {
        mocks.employeeFiltersSafeParse.mockReturnValue({
            success: true,
            data: { search: "สมชาย", status: "ACTIVE", page: 1, limit: 10 },
        });
        mocks.createEmployeeExport.mockResolvedValue({
            status: "ready", recordCount: 12,
            auditFilters: { search: "สมชาย", status: "ACTIVE" },
            response: await createExportResponse(),
        });
        await getEmployeeExport(new NextRequest("http://localhost/api/employees/export?search=สมชาย&status=ACTIVE&page=9&limit=1"));
        expect(mocks.employeeFiltersSafeParse).toHaveBeenCalledWith({ search: "สมชาย", status: "ACTIVE" });
        expect(mocks.createEmployeeExport).toHaveBeenCalledWith({ search: "สมชาย", status: "ACTIVE", page: 1, limit: 10 });
        expect(mocks.logDataExport).toHaveBeenCalledWith("Employee", 5, "user@example.com", {
            metadata: { entityType: "Employee", recordCount: 12,
                filters: { search: "สมชาย", status: "ACTIVE" }, exportedAt: expect.any(String) },
        });
    });

    it("preserves row-limit errors without audit", async () => {
        mocks.createEmployeeExport.mockResolvedValue({ status: "limit-exceeded", recordCount: 2001, maxRows: 2000 });
        const response = await getEmployeeExport(new NextRequest("http://localhost/api/employees/export"));
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: "ส่งออกข้อมูลพนักงานได้ไม่เกิน 2000 รายการต่อครั้ง กรุณากรองข้อมูลเพิ่มเติม",
            maxRows: 2000, recordCount: 2001,
        });
        expect(mocks.logDataExport).not.toHaveBeenCalled();
    });

    it("preserves current USER access to the audit export logging route", async () => {
        const response = await logAuditExport(
            new NextRequest("http://localhost/api/audit-logs/export", {
                method: "POST",
                body: JSON.stringify({
                    entityType: "Employee",
                    recordCount: 0,
                    filters: { status: "ACTIVE" },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.logDataExport).toHaveBeenCalledWith(
            "Employee",
            5,
            "user@example.com",
            expect.objectContaining({
                metadata: expect.objectContaining({
                    recordCount: 0,
                    filters: { status: "ACTIVE" },
                }),
            }),
        );
    });
});
