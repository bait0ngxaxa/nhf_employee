import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    employeeFiltersSafeParse: vi.fn(),
    createEmployeeExport: vi.fn(),
    assertEmployeeCapabilityForMigration: vi.fn(),
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
    assertEmployeeCapabilityForMigration: mocks.assertEmployeeCapabilityForMigration,
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

describe("Phase 0 authorization current-state characterization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
            data: {},
        });
        mocks.buildEmployeeAuthorizationContext.mockImplementation((user) => ({
            authorizationActor: {
                userId: user.id,
                employeeId: null,
                systemRole: user.role,
                channel: "DASHBOARD",
            },
        }));
        mocks.assertEmployeeCapabilityForMigration.mockResolvedValue({
            scopes: ["ALL"],
        });
        mocks.assertEmployeeCapabilityScope.mockImplementation(
            (authorization) => authorization,
        );
        mocks.createEmployeeExport.mockResolvedValue({
            status: "ready",
            recordCount: 0,
            auditFilters: { search: null, status: null },
            response: new Response("csv"),
        });
        mocks.logDataExport.mockResolvedValue(undefined);
    });

    it("preserves current USER access to the Employee export route", async () => {
        const response = await getEmployeeExport(
            new NextRequest("http://localhost/api/employees/export"),
        );

        expect(response.status).toBe(200);
        expect(mocks.assertEmployeeCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({
                authorizationActor: expect.objectContaining({
                    userId: 5,
                    systemRole: "USER",
                    channel: "DASHBOARD",
                }),
            }),
            "employee.export",
        );
        expect(mocks.createEmployeeExport).toHaveBeenCalledWith({});
        expect(mocks.logDataExport).toHaveBeenCalledWith(
            "Employee",
            5,
            "user@example.com",
            expect.any(Object),
        );
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
