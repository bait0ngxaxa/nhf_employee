import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    getCurrentEmployeeLeaveProjection,
    getActionableLeaveApprovalWhere,
    getApproverHistoryReportWhere,
} from "./approval-queries";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe("current Employee Leave projection", () => {
    beforeEach(() => mockReset(prismaMock));

    it("preserves original, exception, and historical approval semantics", async () => {
        prismaMock.leaveRequest.findFirst
            .mockResolvedValueOnce({ id: "original" } as never)
            .mockResolvedValueOnce({ id: "exception" } as never)
            .mockResolvedValueOnce({ id: "history" } as never);

        await expect(getCurrentEmployeeLeaveProjection(101, false)).resolves.toEqual({
            canApproveLeave: true,
            canViewLeaveReports: true,
        });

        const actionable = getActionableLeaveApprovalWhere();
        expect(prismaMock.leaveRequest.findFirst).toHaveBeenNthCalledWith(1, {
            where: {
                approverId: 101,
                exceptionApproverId: null,
                ...actionable,
            },
            select: { id: true },
        });
        expect(prismaMock.leaveRequest.findFirst).toHaveBeenNthCalledWith(2, {
            where: { exceptionApproverId: 101, ...actionable },
            select: { id: true },
        });
        expect(prismaMock.leaveRequest.findFirst).toHaveBeenNthCalledWith(3, {
            where: getApproverHistoryReportWhere(101),
            select: { id: true },
        });
    });

    it("keeps manager hierarchy additive to Leave capability", async () => {
        prismaMock.leaveRequest.findFirst.mockResolvedValue(null);

        await expect(getCurrentEmployeeLeaveProjection(101, true)).resolves.toEqual({
            canApproveLeave: true,
            canViewLeaveReports: true,
        });
    });

    it("does not grant capabilities to an unassigned non-manager", async () => {
        prismaMock.leaveRequest.findFirst.mockResolvedValue(null);

        await expect(getCurrentEmployeeLeaveProjection(101, false)).resolves.toEqual({
            canApproveLeave: false,
            canViewLeaveReports: false,
        });
    });
});
