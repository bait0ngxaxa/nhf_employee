import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/departments/route";
import { requireApiSession } from "@/lib/auth/api";
import { listDepartments } from "@/modules/department";

const departmentMocks = vi.hoisted(() => ({
    listDepartments: vi.fn(),
    buildDepartmentAuthorizationContext: vi.fn(),
    assertDepartmentCapabilityForMigration: vi.fn(),
    assertDepartmentCapabilityScope: vi.fn(),
    DepartmentCapabilityDeniedError: class DepartmentCapabilityDeniedError extends Error {
        readonly statusCode = 403;

        constructor(
            readonly capability: string,
            readonly authorizationReason: string,
        ) {
            super("Forbidden");
        }
    },
}));

vi.mock("@/lib/auth/api", () => ({ requireApiSession: vi.fn() }));
vi.mock("@/modules/department", () => departmentMocks);

const USER = {
    id: 1,
    email: "admin@thainhf.org",
    name: "Admin",
    role: "ADMIN",
};

const DEPARTMENTS = [
    {
        id: 1,
        name: "บริหาร",
        code: "ADMIN",
        description: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
        id: 2,
        name: "วิชาการ",
        code: "ACADEMIC",
        description: "Academic department",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    },
];

describe("GET /api/departments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: USER,
            session: { user: { ...USER, id: String(USER.id) } },
        });
        departmentMocks.buildDepartmentAuthorizationContext.mockReturnValue({
            authorizationActor: {
                userId: USER.id,
                employeeId: null,
                systemRole: USER.role,
                channel: "DASHBOARD",
            },
        });
        departmentMocks.assertDepartmentCapabilityForMigration.mockResolvedValue({
            actor: {
                userId: USER.id,
                employeeId: null,
                systemRole: USER.role,
                channel: "DASHBOARD",
            },
            capability: "department.read",
            decision: {
                capability: "department.read",
                allowed: true,
                scopes: ["ALL"],
                grants: [],
            },
            scopes: ["ALL"],
            usedMigrationCompatibility: false,
        });
        departmentMocks.assertDepartmentCapabilityScope.mockImplementation(
            (authorization) => authorization,
        );
    });

    it("returns 403 without executing the Department query when unauthenticated", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });

        const response = await GET();

        expect(response.status).toBe(403);
        expect(listDepartments).not.toHaveBeenCalled();
    });

    it("returns the compatible full Department response for an authenticated caller", async () => {
        vi.mocked(listDepartments).mockResolvedValue(DEPARTMENTS);

        const response = await GET();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            departments: DEPARTMENTS.map((department) => ({
                ...department,
                createdAt: department.createdAt.toISOString(),
                updatedAt: department.updatedAt.toISOString(),
            })),
        });
        expect(listDepartments).toHaveBeenCalledTimes(1);
        expect(departmentMocks.buildDepartmentAuthorizationContext).toHaveBeenCalledWith(
            USER,
        );
        expect(
            departmentMocks.assertDepartmentCapabilityForMigration,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                authorizationActor: expect.objectContaining({
                    userId: USER.id,
                    systemRole: USER.role,
                    channel: "DASHBOARD",
                }),
            }),
            "department.read",
        );
        expect(departmentMocks.assertDepartmentCapabilityScope).toHaveBeenCalledWith(
            expect.anything(),
            "ALL",
        );
    });

    it("preserves the forbidden response and skips the query when the capability is denied", async () => {
        departmentMocks.assertDepartmentCapabilityForMigration.mockRejectedValue(
            new departmentMocks.DepartmentCapabilityDeniedError(
                "department.read",
                "NO_APPLICABLE_GRANT",
            ),
        );

        const response = await GET();

        expect(response.status).toBe(403);
        expect(listDepartments).not.toHaveBeenCalled();
    });

    it("sanitizes Department query failures as a 500 response", async () => {
        const databaseError = new Error("database details");
        vi.mocked(listDepartments).mockRejectedValue(databaseError);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const response = await GET();

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Operation failed" });
        expect(consoleError).toHaveBeenCalledWith(
            "Error fetching departments:",
            databaseError,
        );
        consoleError.mockRestore();
    });
});
