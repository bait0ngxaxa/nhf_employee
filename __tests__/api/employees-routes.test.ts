import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServerModule from "next/server";

import { PATCH, DELETE } from "@/app/api/employees/[id]/route";
import { POST as createEmployeeRoute } from "@/app/api/employees/route";
import { POST as importEmployeesRoute } from "@/app/api/employees/import/route";
import { requireAdminSession } from "@/lib/auth/api";
import { logEmployeeEvent } from "@/lib/server/audit";
import { employeeService } from "@/lib/services/employee";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback) => callback()) };
});
vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: vi.fn(),
    requireApiSession: vi.fn(),
}));
vi.mock("@/lib/server/audit", () => ({ logEmployeeEvent: vi.fn() }));
vi.mock("@/lib/services/employee", () => ({
    employeeService: {
        createEmployee: vi.fn(),
        updateEmployee: vi.fn(),
        deleteEmployee: vi.fn(),
        importEmployeesFromCSV: vi.fn(),
    },
}));

const ADMIN = {
    id: 99,
    email: "admin@thainhf.org",
    name: "Admin",
    role: "ADMIN",
};

function employeeParams(id: string): { params: Promise<{ id: string }> } {
    return { params: Promise.resolve({ id }) };
}

describe("Employee mutation routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminSession).mockResolvedValue({
            ok: true,
            user: ADMIN,
            session: { user: { ...ADMIN, id: String(ADMIN.id) } },
        });
        vi.mocked(logEmployeeEvent).mockResolvedValue(undefined);
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
        expect(employeeService.updateEmployee).not.toHaveBeenCalled();
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
        expect(employeeService.deleteEmployee).not.toHaveBeenCalled();
    });

    it("PATCH returns the committed linked-user identity from the service", async () => {
        vi.mocked(employeeService.updateEmployee).mockResolvedValue({
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
            },
        ), employeeParams("12"));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            employee: {
                email: "new@thainhf.org",
                user: { email: "new@thainhf.org" },
            },
        });
    });

    it.each([
        ["create", createEmployeeRoute],
        ["import", importEmployeesRoute],
    ] as const)("authenticates before reading the %s request body", async (_label, route) => {
        const authResponse = NextResponse.json({ error: "Forbidden" }, { status: 403 });
        vi.mocked(requireAdminSession).mockResolvedValue({
            ok: false,
            response: authResponse,
        });
        const json = vi.fn().mockRejectedValue(new Error("body must not be read"));

        const response = await route({ json } as unknown as NextRequest);

        expect(response.status).toBe(403);
        expect(json).not.toHaveBeenCalled();
        expect(employeeService.createEmployee).not.toHaveBeenCalled();
        expect(employeeService.importEmployeesFromCSV).not.toHaveBeenCalled();
    });

    it("accepts 1000 import rows for processing", async () => {
        vi.mocked(employeeService.importEmployeesFromCSV).mockResolvedValue({
            success: [],
            errors: [],
        });
        const employees = Array.from({ length: 1000 }, () => ({}));

        const response = await importEmployeesRoute(new NextRequest(
            "http://localhost/api/employees/import",
            { method: "POST", body: JSON.stringify({ employees }) },
        ));

        expect(response.status).toBe(200);
        expect(employeeService.importEmployeesFromCSV).toHaveBeenCalledWith(employees);
    });

    it("rejects 1001 import rows before entering the import service", async () => {
        const employees = Array.from({ length: 1001 }, () => ({}));

        const response = await importEmployeesRoute(new NextRequest(
            "http://localhost/api/employees/import",
            { method: "POST", body: JSON.stringify({ employees }) },
        ));

        expect(response.status).toBe(400);
        expect(employeeService.importEmployeesFromCSV).not.toHaveBeenCalled();
    });
});
