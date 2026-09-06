import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/departments/route";
import { requireApiSession } from "@/lib/auth/api";
import { listDepartments } from "@/modules/department";

vi.mock("@/lib/auth/api", () => ({ requireApiSession: vi.fn() }));
vi.mock("@/modules/department", () => ({ listDepartments: vi.fn() }));

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
