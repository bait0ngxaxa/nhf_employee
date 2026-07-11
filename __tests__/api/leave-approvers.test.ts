import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/leave/approvers/route";
import { requireAdminSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/auth/api", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        employee: { update: vi.fn() },
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
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") return callback(prisma);
            return callback;
        });
        vi.mocked(prisma.employee.update).mockResolvedValue({ id: 10 } as never);
    });

    it("transfers only pending requests when the administrator selects transfer", async () => {
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 3 });

        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({
                assignments: [{ employeeId: 10, managerId: 20, transferPendingRequests: true }],
            }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: { employeeId: 10, status: "PENDING", approverId: { not: 20 } },
            data: { approverId: 20 },
        });
        expect(await response.json()).toMatchObject({ transferredLeaveRequestCount: 3 });
    });

    it("does not transfer pending requests unless selected", async () => {
        const response = await PUT(new NextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({ assignments: [{ employeeId: 10, managerId: 20 }] }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(await response.json()).toMatchObject({ transferredLeaveRequestCount: 0 });
    });
});
