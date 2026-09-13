import { after, NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServerModule from "next/server";

import { PATCH, DELETE } from "@/app/api/employees/[id]/route";
import {
    GET as listEmployeesRoute,
    POST as createEmployeeRoute,
} from "@/app/api/employees/route";
import { POST as importEmployeesRoute } from "@/app/api/employees/import/route";
import { GET as getEmployeeStatsRoute } from "@/app/api/employees/stats/route";
import { employeeAccountLifecycle } from "@/modules/auth";
import { requireApiSession } from "@/lib/auth/api";
import {
    appendEmployeeCreateAudit,
    appendEmployeeDeleteAudit,
    appendEmployeeUpdateAudit,
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationContext,
    createEmployee,
    deleteEmployee,
    EmployeeCapabilityDeniedError,
    employeeFiltersSchema,
    importEmployeesFromCsvRows,
    getEmployeeStats,
    listEmployees,
    updateEmployee,
} from "@/modules/employee";
import { getEmployeeLeaveOffboardingBlockers } from "@/modules/leave";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback) => callback()) };
});
vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
}));
vi.mock("@/modules/employee", () => ({
    EmployeeCapabilityDeniedError: class EmployeeCapabilityDeniedError extends Error {
        readonly statusCode = 403;
    },
    EMPLOYEE_IMPORT_MAX_ROWS: 1000,
    appendEmployeeCreateAudit: vi.fn(),
    appendEmployeeDeleteAudit: vi.fn(),
    appendEmployeeUpdateAudit: vi.fn(),
    assertEmployeeCapabilityForMigration: vi.fn(),
    assertEmployeeCapabilityScope: vi.fn(),
    buildEmployeeAuthorizationContext: vi.fn((user) => ({
        authorizationActor: {
            userId: user.id,
            employeeId: null,
            systemRole: user.role as "ADMIN" | "USER",
            channel: "DASHBOARD",
        },
    })),
    buildEmployeeAuthorizedCommandActor: vi.fn((user) => ({
        userId: user.id,
        email: user.email,
        authorization: {
            authorizationActor: {
                userId: user.id,
                employeeId: null,
                systemRole: user.role as "ADMIN" | "USER",
                channel: "DASHBOARD",
            },
        },
    })),
    createEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
    employeeFiltersSchema: { safeParse: vi.fn() },
    getEmployeeStats: vi.fn(),
    getEmployeeDisplayName: vi.fn(() => "Test Employee"),
    importEmployeesFromCsvRows: vi.fn(),
    listEmployees: vi.fn(),
    updateEmployee: vi.fn(),
    updateEmployeeSchema: {
        safeParse: vi.fn((value) => ({ success: true, data: value })),
    },
    createEmployeeSchema: {
        safeParse: vi.fn((value) => ({ success: true, data: value })),
    },
}));
vi.mock("@/modules/leave", () => ({
    getEmployeeLeaveOffboardingBlockers: vi.fn(),
}));

const ADMIN = {
    id: 99,
    email: "admin@thainhf.org",
    name: "Admin",
    role: "ADMIN",
};

const USER = {
    id: 100,
    email: "user@thainhf.org",
    name: "User",
    role: "USER",
};

function employeeParams(id: string): { params: Promise<{ id: string }> } {
    return { params: Promise.resolve({ id }) };
}

function denyEmployeeCapability(capability: string): void {
    vi.mocked(assertEmployeeCapabilityForMigration).mockRejectedValue(
        new EmployeeCapabilityDeniedError(capability, "CHANNEL_NOT_SUPPORTED"),
    );
}

describe("Employee mutation routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: ADMIN,
            session: { user: { ...ADMIN, id: String(ADMIN.id) } },
        });
        vi.mocked(assertEmployeeCapabilityForMigration).mockResolvedValue({
            scopes: ["ALL"],
        } as never);
        vi.mocked(assertEmployeeCapabilityScope).mockImplementation(
            (authorization) => authorization,
        );
        vi.mocked(buildEmployeeAuthorizationContext).mockImplementation((user) => ({
            authorizationActor: {
                userId: user.id,
                employeeId: null,
                systemRole: user.role as "ADMIN" | "USER",
                channel: "DASHBOARD",
            },
        }));
        vi.mocked(employeeFiltersSchema.safeParse).mockReturnValue({
            success: true,
            data: { search: "Somchai", status: undefined, page: 1, limit: 10 },
        } as never);
        vi.mocked(appendEmployeeCreateAudit).mockResolvedValue(undefined);
        vi.mocked(appendEmployeeDeleteAudit).mockResolvedValue(undefined);
        vi.mocked(appendEmployeeUpdateAudit).mockResolvedValue(undefined);
    });

    it("keeps the organization-wide Employee list behind employee.read", async () => {
        vi.mocked(listEmployees).mockResolvedValue({
            employees: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });

        const response = await listEmployeesRoute(new NextRequest(
            "http://localhost/api/employees?search=Somchai",
        ));

        expect(response.status).toBe(200);
        expect(assertEmployeeCapabilityForMigration).toHaveBeenCalledWith(
            expect.any(Object),
            "employee.read",
        );
        expect(listEmployees).toHaveBeenCalledWith({
            search: "Somchai",
            status: undefined,
            page: 1,
            limit: 10,
        });
    });

    it("keeps organization-wide Employee statistics behind employee.stats.read", async () => {
        vi.mocked(getEmployeeStats).mockResolvedValue({
            total: 2,
            active: 1,
            inactive: 1,
            suspended: 0,
            admin: 1,
            academic: 0,
        });

        const response = await getEmployeeStatsRoute();

        expect(response.status).toBe(200);
        expect(assertEmployeeCapabilityForMigration).toHaveBeenCalledWith(
            expect.any(Object),
            "employee.stats.read",
        );
        expect(getEmployeeStats).toHaveBeenCalledOnce();
    });

    it.each([
        "12abc",
        "abc",
        "1.5",
        "-1",
        "0",
        "+1",
        "1e2",
        " 12 ",
        "9007199254740992",
    ])("PATCH rejects invalid employee ID %j", async (id) => {
        const response = await PATCH(new NextRequest(
            `http://localhost/api/employees/${encodeURIComponent(id)}`,
            { method: "PATCH", body: JSON.stringify({ firstName: "New" }) },
        ), employeeParams(id));

        expect(response.status).toBe(400);
        expect(updateEmployee).not.toHaveBeenCalled();
    });

    it.each([
        "12abc",
        "abc",
        "1.5",
        "-1",
        "0",
        "+1",
        "1e2",
        " 12 ",
        "9007199254740992",
    ])("DELETE rejects invalid employee ID %j", async (id) => {
        const response = await DELETE(new NextRequest(
            `http://localhost/api/employees/${encodeURIComponent(id)}`,
            { method: "DELETE" },
        ), employeeParams(id));

        expect(response.status).toBe(400);
        expect(deleteEmployee).not.toHaveBeenCalled();
    });

    it("PATCH returns the committed linked-user identity from the service", async () => {
        vi.mocked(updateEmployee).mockResolvedValue({
            success: true,
            employee: {
                id: 12,
                email: "new@thainhf.org",
                user: { id: 20, email: "new@thainhf.org", role: "USER" },
            },
        } as never);

        const response = await PATCH(new NextRequest(
            "http://localhost/api/employees/12",
            {
                method: "PATCH",
                body: JSON.stringify({
                    email: "new@thainhf.org",
                    status: "SUSPENDED",
                }),
                headers: {
                    "cf-connecting-ip": "203.0.113.10",
                    "user-agent": "employee-route-test",
                },
            },
        ), employeeParams("12"));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            employee: {
                email: "new@thainhf.org",
                user: { email: "new@thainhf.org" },
            },
        });
        expect(updateEmployee).toHaveBeenCalledWith(
            12,
            { email: "new@thainhf.org", status: "SUSPENDED" },
            expect.objectContaining({
                userId: ADMIN.id,
                email: ADMIN.email,
                authorization: {
                    authorizationActor: {
                        userId: ADMIN.id,
                        employeeId: null,
                        systemRole: "ADMIN",
                        channel: "DASHBOARD",
                    },
                },
            }),
            getEmployeeLeaveOffboardingBlockers,
            employeeAccountLifecycle,
        );
        expect(appendEmployeeUpdateAudit).toHaveBeenCalledWith({
            employeeId: 12,
            actor: {
                userId: ADMIN.id,
                email: ADMIN.email,
                ipAddress: "203.0.113.10",
                userAgent: "employee-route-test",
            },
            before: undefined,
            after: { email: "new@thainhf.org", status: "SUSPENDED" },
            employee: {
                id: 12,
                email: "new@thainhf.org",
                user: { id: 20, email: "new@thainhf.org", role: "USER" },
            },
            statusChanged: true,
        });
    });

    it("schedules Employee create Audit after the response path is established", async () => {
        vi.mocked(createEmployee).mockResolvedValue({
            success: true,
            employee: {
                id: 12,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                email: "somchai@thainhf.org",
                position: "เจ้าหน้าที่",
                departmentId: 4,
            },
        } as never);

        const response = await createEmployeeRoute(new NextRequest(
            "http://localhost/api/employees",
            {
                method: "POST",
                body: JSON.stringify({
                    firstName: "สมชาย",
                    lastName: "ใจดี",
                    nickname: null,
                    email: "somchai@thainhf.org",
                    position: "เจ้าหน้าที่",
                    departmentId: 4,
                }),
                headers: {
                    "cf-connecting-ip": "203.0.113.11",
                    "user-agent": "employee-create-route-test",
                },
            },
        ));

        expect(response.status).toBe(201);
        expect(appendEmployeeCreateAudit).toHaveBeenCalledWith(
            expect.objectContaining({ id: 12, email: "somchai@thainhf.org" }),
            {
                userId: ADMIN.id,
                email: ADMIN.email,
                ipAddress: "203.0.113.11",
                userAgent: "employee-create-route-test",
            },
        );
    });

    it("passes the Leave blocker provider to DELETE lifecycle composition", async () => {
        vi.mocked(deleteEmployee).mockResolvedValue({
            success: true,
            auditRecorded: true,
        });

        const response = await DELETE(new NextRequest(
            "http://localhost/api/employees/12",
            { method: "DELETE" },
        ), employeeParams("12"));

        expect(response.status).toBe(200);
        expect(deleteEmployee).toHaveBeenCalledWith(
            12,
            expect.objectContaining({
                userId: ADMIN.id,
                email: ADMIN.email,
                authorization: {
                    authorizationActor: {
                        userId: ADMIN.id,
                        employeeId: null,
                        systemRole: "ADMIN",
                        channel: "DASHBOARD",
                    },
                },
            }),
            getEmployeeLeaveOffboardingBlockers,
            employeeAccountLifecycle,
        );
        expect(appendEmployeeDeleteAudit).not.toHaveBeenCalled();
    });

    it("keeps DELETE fallback Audit best-effort when no lifecycle event was recorded", async () => {
        vi.mocked(deleteEmployee).mockResolvedValue({
            success: true,
            beforeData: { status: "ACTIVE", deletedAt: null },
            auditRecorded: false,
        });

        const response = await DELETE(new NextRequest(
            "http://localhost/api/employees/12",
            {
                method: "DELETE",
                headers: {
                    "cf-connecting-ip": "203.0.113.12",
                    "user-agent": "employee-delete-route-test",
                },
            },
        ), employeeParams("12"));

        expect(response.status).toBe(200);
        expect(appendEmployeeDeleteAudit).toHaveBeenCalledWith({
            employeeId: 12,
            actor: {
                userId: ADMIN.id,
                email: ADMIN.email,
                ipAddress: "203.0.113.12",
                userAgent: "employee-delete-route-test",
            },
            before: { status: "ACTIVE", deletedAt: null },
        });
    });

    it.each([
        ["create", createEmployeeRoute],
        ["import", importEmployeesRoute],
    ] as const)("authenticates before reading the %s request body", async (_label, route) => {
        const authResponse = NextResponse.json({ error: "Forbidden" }, { status: 403 });
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: false,
            response: authResponse,
        });
        const json = vi.fn().mockRejectedValue(new Error("body must not be read"));

        const response = await route({ json } as unknown as NextRequest);

        expect(response.status).toBe(403);
        expect(json).not.toHaveBeenCalled();
        expect(createEmployee).not.toHaveBeenCalled();
        expect(importEmployeesFromCsvRows).not.toHaveBeenCalled();
    });

    it("allows an explicitly authorized USER to reach the update application boundary", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: USER,
            session: { user: { ...USER, id: String(USER.id) } },
        });
        vi.mocked(updateEmployee).mockResolvedValue({
            success: true,
            employee: { id: 12 },
        } as never);

        const response = await PATCH(new NextRequest(
            "http://localhost/api/employees/12",
            { method: "PATCH", body: JSON.stringify({ firstName: "Granted" }) },
        ), employeeParams("12"));

        expect(response.status).toBe(200);
        expect(assertEmployeeCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({
                authorizationActor: expect.objectContaining({
                    userId: USER.id,
                    systemRole: "USER",
                    channel: "DASHBOARD",
                }),
            }),
            "employee.update",
        );
        expect(updateEmployee).toHaveBeenCalledWith(
            12,
            { firstName: "Granted" },
            expect.objectContaining({ userId: USER.id, email: USER.email }),
            getEmployeeLeaveOffboardingBlockers,
            employeeAccountLifecycle,
        );
    });

    it("returns 403 before consuming the body or scheduling audit when create is denied", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: USER,
            session: { user: { ...USER, id: String(USER.id) } },
        });
        denyEmployeeCapability("employee.create");
        const json = vi.fn().mockRejectedValue(new Error("body must not be read"));

        const response = await createEmployeeRoute({ json } as unknown as NextRequest);

        expect(response.status).toBe(403);
        expect(json).not.toHaveBeenCalled();
        expect(createEmployee).not.toHaveBeenCalled();
        expect(appendEmployeeCreateAudit).not.toHaveBeenCalled();
        expect(after).not.toHaveBeenCalled();
    });

    it("returns 403 before consuming the body or scheduling audit when import is denied", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: USER,
            session: { user: { ...USER, id: String(USER.id) } },
        });
        denyEmployeeCapability("employee.import");
        const json = vi.fn().mockRejectedValue(new Error("body must not be read"));

        const response = await importEmployeesRoute({ json } as unknown as NextRequest);

        expect(response.status).toBe(403);
        expect(json).not.toHaveBeenCalled();
        expect(importEmployeesFromCsvRows).not.toHaveBeenCalled();
        expect(after).not.toHaveBeenCalled();
    });

    it("returns 403 without calling the update service or scheduling audit when update is denied", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: USER,
            session: { user: { ...USER, id: String(USER.id) } },
        });
        denyEmployeeCapability("employee.update");

        const response = await PATCH(new NextRequest(
            "http://localhost/api/employees/12",
            { method: "PATCH", body: JSON.stringify({ firstName: "Denied" }) },
        ), employeeParams("12"));

        expect(response.status).toBe(403);
        expect(updateEmployee).not.toHaveBeenCalled();
        expect(appendEmployeeUpdateAudit).not.toHaveBeenCalled();
        expect(after).not.toHaveBeenCalled();
    });

    it("returns 403 without calling the delete service or scheduling audit when delete is denied", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: USER,
            session: { user: { ...USER, id: String(USER.id) } },
        });
        denyEmployeeCapability("employee.delete");

        const response = await DELETE(new NextRequest(
            "http://localhost/api/employees/12",
            { method: "DELETE" },
        ), employeeParams("12"));

        expect(response.status).toBe(403);
        expect(deleteEmployee).not.toHaveBeenCalled();
        expect(appendEmployeeDeleteAudit).not.toHaveBeenCalled();
        expect(after).not.toHaveBeenCalled();
    });

    it("accepts 1000 import rows for processing", async () => {
        vi.mocked(importEmployeesFromCsvRows).mockResolvedValue({
            success: [],
            errors: [],
        });
        const employees = Array.from({ length: 1000 }, () => ({}));

        const response = await importEmployeesRoute(new NextRequest(
            "http://localhost/api/employees/import",
            { method: "POST", body: JSON.stringify({ employees }) },
        ));

        expect(response.status).toBe(200);
        expect(importEmployeesFromCsvRows).toHaveBeenCalledWith(employees);
    });

    it("rejects 1001 import rows before entering the import service", async () => {
        const employees = Array.from({ length: 1001 }, () => ({}));

        const response = await importEmployeesRoute(new NextRequest(
            "http://localhost/api/employees/import",
            { method: "POST", body: JSON.stringify({ employees }) },
        ));

        expect(response.status).toBe(400);
        expect(importEmployeesFromCsvRows).not.toHaveBeenCalled();
    });
});
