import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/leave/approvers/route";
import { requireAdminSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "@/lib/services/leave/approver-assignment";

vi.mock("@/lib/auth/api", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        employee: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/services/leave/approver-assignment", () => {
    class MockApproverAssignmentError extends Error {
        readonly statusCode: number;

        constructor(message: string, statusCode = 400) {
            super(message);
            this.statusCode = statusCode;
        }
    }
    return {
        ApproverAssignmentError: MockApproverAssignmentError,
        assignLeaveApprovers: vi.fn(),
    };
});

const ACTIVE_EMPLOYEE = {
    id: 10,
    firstName: "Active",
    lastName: "Employee",
    nickname: null,
    email: "active@thainhf.org",
    position: "Officer",
    status: "ACTIVE",
    deletedAt: null,
    managerId: null,
    dept: { name: "Operations" },
    user: {
        id: 100,
        email: "active@thainhf.org",
        isActive: true,
        deletedAt: null,
    },
};

describe("GET /api/leave/approvers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "1", role: "ADMIN" } },
            user: { id: 1, email: "admin@example.com", name: "Admin", role: "ADMIN" },
        });
        vi.mocked(prisma.employee.findMany).mockResolvedValue([ACTIVE_EMPLOYEE] as never);
    });

    it("queries and returns only employees with an active user account", async () => {
        const response = await GET();

        expect(response.status).toBe(200);
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    is: {
                        isActive: true,
                        deletedAt: null,
                    },
                },
            },
        }));

        const body = await response.json() as {
            employees: Array<{ id: number; canApproveLeave: boolean }>;
        };
        expect(body.employees).toEqual([
            expect.objectContaining({ id: 10, canApproveLeave: true }),
        ]);
    });
});

describe("PUT /api/leave/approvers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "1", role: "ADMIN" } },
            user: { id: 1, email: "admin@example.com", name: "Admin", role: "ADMIN" },
        });
        vi.mocked(assignLeaveApprovers).mockResolvedValue(undefined);
    });

    it("accepts the assignment payload without legacy fields", async () => {
        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({ assignments: [{ employeeId: 10, managerId: 20 }] }),
        }));

        expect(response.status).toBe(200);
        expect(assignLeaveApprovers).toHaveBeenCalledWith(
            [{ employeeId: 10, managerId: 20 }],
            { userId: 1, email: "admin@example.com" },
        );
    });

    it("returns the pending-request conflict from the service", async () => {
        vi.mocked(assignLeaveApprovers).mockRejectedValue(
            new ApproverAssignmentError(
                "พนักงานมีคำขอลารออนุมัติ กรุณาให้พนักงานยกเลิกคำขอก่อนเปลี่ยนผู้อนุมัติ",
                409,
            ),
        );

        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({ assignments: [{ employeeId: 10, managerId: 20 }] }),
        }));

        expect(response.status).toBe(409);
    });
});
