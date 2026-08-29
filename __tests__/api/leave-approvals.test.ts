import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getLeaveApprovals } from "@/app/api/leave/approvals/route";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { getAssignedLeaveApproverWhere } from "@/lib/services/leave/approval-queries";

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
    status: "PENDING" | "APPROVED",
    exceptionApproverId: number | null = null,
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
        exceptionApproverId,
        approvedAt: status === "APPROVED" ? new Date("2027-01-02T00:00:00.000Z") : null,
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
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
        attachments: [
            {
                id: `${id}-attachment`,
                contentType: "image/webp",
                sizeBytes: 45_678,
                width: 1600,
                height: 1200,
            },
        ],
    };
}

describe("GET /api/leave/approvals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            employeeId: 200,
            user: { role: "USER" },
        } as never);
        vi.mocked(prisma.leaveRequest.findMany)
            .mockResolvedValueOnce([createLeaveRequest("pending-1", "PENDING")] as never)
            .mockResolvedValueOnce([createLeaveRequest("not-taken-1", "APPROVED")] as never)
            .mockResolvedValueOnce([createLeaveRequest("history-1", "APPROVED")] as never)
            .mockResolvedValueOnce([] as never);
        vi.mocked(prisma.leaveRequest.count)
            .mockResolvedValueOnce(11)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(21)
            .mockResolvedValueOnce(0);
    });

    it("returns attachment summaries in every approval list without changing pagination", async () => {
        const response = await getLeaveApprovals(
            new Request(
                "http://localhost/api/leave/approvals?pendingPage=2&notTakenPage=1&historyPage=3",
            ),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.pending[0].attachments[0]).toEqual({
            id: "pending-1-attachment",
            contentType: "image/webp",
            sizeBytes: 45_678,
            width: 1600,
            height: 1200,
            viewUrl: "/api/leave/attachments/pending-1-attachment",
        });
        expect(body.notTakenPending[0].attachments[0].viewUrl).toBe(
            "/api/leave/attachments/not-taken-1-attachment",
        );
        expect(body.history[0].attachments[0].viewUrl).toBe(
            "/api/leave/attachments/history-1-attachment",
        );
        expect(body.metadata).toEqual({
            pending: {
                currentPage: 2,
                totalPages: 2,
                totalItems: 11,
                itemsPerPage: 10,
            },
            notTakenPending: {
                currentPage: 1,
                totalPages: 1,
                totalItems: 1,
                itemsPerPage: 10,
            },
            history: {
                currentPage: 3,
                totalPages: 3,
                totalItems: 21,
                itemsPerPage: 10,
            },
            cancellationPending: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: 10,
            },
        });
        expect(JSON.stringify(body)).not.toContain("storageKey");
        expect(prisma.leaveRequest.findMany).toHaveBeenCalledTimes(4);
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[0][0]).toEqual(
            expect.objectContaining({
                skip: 10,
                take: 10,
                orderBy: { createdAt: "asc" },
            }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[1][0]).toEqual(
            expect.objectContaining({
                skip: 0,
                take: 10,
                orderBy: { notTakenRequestedAt: "asc" },
            }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[2][0]).toEqual(
            expect.objectContaining({
                skip: 20,
                take: 10,
                orderBy: { updatedAt: "desc" },
                where: {
                    AND: [
                        {
                            employeeId: { not: 200 },
                            OR: [
                                { exceptionApproverId: 200 },
                                { exceptionApproverId: null, approverId: 200 },
                            ],
                        },
                        expect.objectContaining({ OR: expect.any(Array) }),
                    ],
                },
            }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[3][0]).toEqual(
            expect.objectContaining({
                skip: 0,
                take: 10,
                orderBy: { cancellationRequestedAt: "asc" },
            }),
        );
        for (const call of vi.mocked(prisma.leaveRequest.findMany).mock.calls) {
            expect(call[0]).toEqual(
                expect.objectContaining({
                    include: expect.objectContaining({
                        attachments: expect.objectContaining({
                            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                        }),
                    }),
                }),
            );
        }
    });

    it("keeps an admin in the normal assigned-approver workload", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            employeeId: 999,
            user: { role: "ADMIN" },
        } as never);

        const response = await getLeaveApprovals(
            new Request("http://localhost/api/leave/approvals"),
        );

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.findMany).toHaveBeenCalledTimes(4);
        expect(prisma.leaveRequest.count).toHaveBeenCalledTimes(4);
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[0][0]).toEqual(
            expect.objectContaining({
                where: {
                    employeeId: { not: 999 },
                    OR: [
                        { exceptionApproverId: 999 },
                        { exceptionApproverId: null, approverId: 999 },
                    ],
                    status: "PENDING",
                },
            }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[1][0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({
                    employeeId: { not: 999 },
                    OR: expect.arrayContaining([
                        { exceptionApproverId: 999 },
                        { exceptionApproverId: null, approverId: 999 },
                    ]),
                }),
            }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[2][0]).toEqual(
            expect.objectContaining({
                where: {
                    AND: [
                        {
                            employeeId: { not: 999 },
                            OR: [
                                { exceptionApproverId: 999 },
                                { exceptionApproverId: null, approverId: 999 },
                            ],
                        },
                        expect.objectContaining({ OR: expect.any(Array) }),
                    ],
                },
            }),
        );
        expect(JSON.stringify(await response.json())).not.toContain("__admin_recovery_");
    });

    it("keeps approval history scoped to the effective approver", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            employeeId: 50,
            user: { role: "USER" },
        } as never);
        const historicalExceptionAssignment = {
            ...createLeaveRequest("history-exception-1", "APPROVED", 50),
            status: "NOT_TAKEN",
            notTakenRequestedAt: new Date("2027-01-05T00:00:00.000Z"),
            notTakenConfirmedAt: new Date("2027-01-06T00:00:00.000Z"),
        };
        vi.mocked(prisma.leaveRequest.findMany).mockReset();
        vi.mocked(prisma.leaveRequest.findMany)
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce([historicalExceptionAssignment] as never)
            .mockResolvedValueOnce([] as never);
        vi.mocked(prisma.leaveRequest.count).mockReset();
        vi.mocked(prisma.leaveRequest.count)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0);

        const response = await getLeaveApprovals(
            new Request("http://localhost/api/leave/approvals"),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.history).toEqual([
            expect.objectContaining({ id: "history-exception-1", status: "NOT_TAKEN" }),
        ]);
        const historyWhere = vi.mocked(prisma.leaveRequest.findMany).mock.calls[2]?.[0]?.where;
        expect(historyWhere).toEqual({
            AND: [
                getAssignedLeaveApproverWhere(50),
                {
                    OR: [
                        { status: { in: ["REJECTED", "NOT_TAKEN", "CANCELLED_AFTER_APPROVAL"] } },
                        {
                            status: "APPROVED",
                            OR: [
                                { notTakenRequestedAt: null },
                                { notTakenConfirmedAt: { not: null } },
                            ],
                        },
                    ],
                },
            ],
        });

        const originalApproverWhere = getAssignedLeaveApproverWhere(10);
        expect(originalApproverWhere).toEqual({
            employeeId: { not: 10 },
            OR: [
                { exceptionApproverId: 10 },
                { exceptionApproverId: null, approverId: 10 },
            ],
        });
    });
});
