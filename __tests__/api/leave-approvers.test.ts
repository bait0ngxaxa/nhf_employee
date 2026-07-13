import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/leave/approvers/route";
import { requireAdminSession } from "@/lib/auth/api";
import {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "@/lib/services/leave/approver-assignment";

vi.mock("@/lib/auth/api", () => ({ requireAdminSession: vi.fn() }));
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
vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        employee: { findUnique: vi.fn(), update: vi.fn() },
        leaveRequest: { updateMany: vi.fn() },
    },
}));

describe("PUT /api/leave/approvers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "1", role: "ADMIN" } },
            user: { id: 1, email: "admin@example.com", name: "Admin", role: "ADMIN" },
        });
        vi.mocked(assignLeaveApprovers).mockResolvedValue({
            transferredLeaveRequestCount: 0,
        });
    });

    it("transfers only pending requests when the administrator selects transfer", async () => {
        vi.mocked(assignLeaveApprovers).mockResolvedValue({
            transferredLeaveRequestCount: 3,
        });

        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({
                assignments: [{ employeeId: 10, managerId: 20, transferPendingRequests: true }],
            }),
        }));

        expect(response.status).toBe(200);
        expect(assignLeaveApprovers).toHaveBeenCalledWith(
            [{ employeeId: 10, managerId: 20, transferPendingRequests: true }],
            { userId: 1, email: "admin@example.com" },
        );
        expect(await response.json()).toMatchObject({ transferredLeaveRequestCount: 3 });
    });

    it("rejects an inactive approver before starting the transaction", async () => {
        vi.mocked(assignLeaveApprovers).mockRejectedValue(
            new ApproverAssignmentError("ผู้อนุมัติไม่พร้อมใช้งาน"),
        );

        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({
                assignments: [{ employeeId: 10, managerId: 20, transferPendingRequests: true }],
            }),
        }));

        expect(response.status).toBe(400);
        expect(assignLeaveApprovers).toHaveBeenCalledTimes(1);
    });

    it("always applies the central transfer policy when the flag is omitted", async () => {
        vi.mocked(assignLeaveApprovers).mockResolvedValue({
            transferredLeaveRequestCount: 2,
        });
        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({ assignments: [{ employeeId: 10, managerId: 20 }] }),
        }));

        expect(response.status).toBe(200);
        expect(assignLeaveApprovers).toHaveBeenCalledWith(
            [{ employeeId: 10, managerId: 20 }],
            { userId: 1, email: "admin@example.com" },
        );
        expect(await response.json()).toMatchObject({ transferredLeaveRequestCount: 2 });
    });
});
