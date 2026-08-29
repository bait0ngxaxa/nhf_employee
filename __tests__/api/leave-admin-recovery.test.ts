import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leave/admin/recovery/route";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        leaveRequest: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

function createLeaveRequest(
    id: string,
    status: "APPROVED" | "CANCELLATION_REQUESTED",
) {
    return {
        id,
        employeeId: 100,
        leaveType: "SICK",
        startDate: new Date("2027-01-04T00:00:00.000Z"),
        endDate: new Date("2027-01-04T00:00:00.000Z"),
        period: "FULL_DAY",
        durationHalfDays: 2,
        reason: "พักรักษาตัว",
        emergencyReason: null,
        specialReason: null,
        overQuotaHalfDays: 0,
        status,
        approverId: 200,
        exceptionApproverId: null,
        exceptionApproverAssignedAt: null,
        approvedAt: new Date("2027-01-02T00:00:00.000Z"),
        rejectReason: null,
        notTakenReason: "ไม่ได้ใช้วันลา",
        notTakenRequestedAt: new Date("2027-01-05T00:00:00.000Z"),
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: "เปลี่ยนแผนการลา",
        cancellationRequestedAt: new Date("2027-01-03T00:00:00.000Z"),
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachmentUrl: null,
        createdAt: new Date("2027-01-01T00:00:00.000Z"),
        updatedAt: new Date("2027-01-02T00:00:00.000Z"),
        employee: {
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            position: "เจ้าหน้าที่",
            departmentId: 1,
            dept: { name: "งานกลาง" },
        },
        attachments: [],
    };
}

describe("GET /api/leave/admin/recovery", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            employeeId: 999,
            user: { role: "ADMIN" },
        } as never);
        vi.mocked(prisma.leaveRequest.findMany)
            .mockResolvedValueOnce([createLeaveRequest("not-taken-1", "APPROVED")] as never)
            .mockResolvedValueOnce([createLeaveRequest("cancellation-1", "CANCELLATION_REQUESTED")] as never);
        vi.mocked(prisma.leaveRequest.count)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1);
    });

    it("returns only unavailable-approver recovery candidates", async () => {
        const response = await GET(
            new Request(
                "http://localhost/api/leave/admin/recovery?notTakenPage=2&cancellationPage=3",
            ),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.notTakenPending).toHaveLength(1);
        expect(body.cancellationPending).toHaveLength(1);
        expect(body.metadata).toEqual({
            notTakenPending: {
                currentPage: 2,
                totalPages: 1,
                totalItems: 1,
                itemsPerPage: 10,
            },
            cancellationPending: {
                currentPage: 3,
                totalPages: 1,
                totalItems: 1,
                itemsPerPage: 10,
            },
        });

        const firstFindManyCall = vi.mocked(prisma.leaveRequest.findMany).mock.calls[0];
        if (!firstFindManyCall) {
            throw new Error("Expected recovery query");
        }
        const [recoveryArgs] = firstFindManyCall;
        if (!recoveryArgs) {
            throw new Error("Expected recovery query arguments");
        }
        const recoveryWhere = recoveryArgs.where;
        expect(recoveryWhere).toEqual(expect.objectContaining({
            employeeId: { not: 999 },
            AND: [
                { NOT: { exceptionApproverId: 999 } },
                { NOT: { exceptionApproverId: null, approverId: 999 } },
            ],
            OR: [
                {
                    exceptionApproverId: null,
                    OR: [
                        { approverId: null },
                        expect.objectContaining({ approver: expect.any(Object) }),
                    ],
                },
                {
                    exceptionApproverId: { not: null },
                    exceptionApprover: expect.any(Object),
                },
            ],
        }));
        expect(recoveryWhere).not.toEqual(expect.objectContaining({
            id: expect.stringContaining("__admin_recovery"),
        }));
    });

    it("rejects a non-admin before querying recovery data", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            employeeId: 30,
            user: { role: "USER" },
        } as never);

        const response = await GET(
            new Request("http://localhost/api/leave/admin/recovery"),
        );

        expect(response.status).toBe(403);
        expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
        expect(prisma.leaveRequest.count).not.toHaveBeenCalled();
    });
});
