import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { appendAuditInTransaction } from "@/modules/audit";
import type { LeaveAuditDetailsFor } from "@/modules/leave/domain/audit";
import {
    createLeaveAuditInTransaction,
    lockEmployeeRows,
    lockLeaveRequestRow,
} from "./transaction";

vi.mock("@/modules/audit", () => ({
    appendAuditInTransaction: vi.fn(),
}));

const transaction = mockDeep<Prisma.TransactionClient>();
const details: LeaveAuditDetailsFor<"LEAVE_REQUEST_APPROVE"> = {
    before: { status: "PENDING" },
    after: { status: "APPROVED" },
    metadata: {
        leaveRequestId: "clx_leave_request_123",
        employeeId: 21,
        employeeName: "สมชาย ใจดี",
        leaveType: "VACATION",
        startDate: "2026-08-03T00:00:00.000Z",
        endDate: "2026-08-03T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        decision: "APPROVE",
    },
};

type QueryRawMock = ReturnType<typeof vi.fn>;

describe("leave transaction helpers", () => {
    it("deduplicates and sorts employee IDs before acquiring the row lock", async () => {
        const queryRaw: QueryRawMock = vi.fn().mockResolvedValue([]);
        const tx = { $queryRaw: queryRaw };

        await lockEmployeeRows(tx as never, [4, 2, 4, 1, 2]);

        expect(queryRaw).toHaveBeenCalledTimes(1);
        const values = queryRaw.mock.calls[0][1] as { values: number[] };
        expect(values.values).toEqual([1, 2, 4]);
    });

    it("does not query when there are no employee IDs", async () => {
        const queryRaw: QueryRawMock = vi.fn();

        await lockEmployeeRows({ $queryRaw: queryRaw } as never, []);

        expect(queryRaw).not.toHaveBeenCalled();
    });

    it("locks the requested leave row with the correct ID", async () => {
        const queryRaw: QueryRawMock = vi.fn().mockResolvedValue([]);

        await lockLeaveRequestRow({ $queryRaw: queryRaw } as never, "leave-42");

        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(queryRaw.mock.calls[0][1]).toBe("leave-42");
    });

    it("fails closed when a transaction client cannot execute raw SQL", async () => {
        await expect(lockEmployeeRows({} as never, [1])).rejects.toThrow();
        await expect(lockLeaveRequestRow({} as never, "leave-1")).rejects.toThrow();
    });
});

describe("Leave transaction Audit producer", () => {
    beforeEach(() => {
        vi.mocked(appendAuditInTransaction).mockReset();
    });

    it("passes the caller transaction and keeps the Leave CUID in metadata", async () => {
        await createLeaveAuditInTransaction(
            transaction,
            "LEAVE_REQUEST_APPROVE",
            "clx_leave_request_123",
            null,
            "admin@thainhf.org",
            details,
        );

        expect(appendAuditInTransaction).toHaveBeenCalledWith(transaction, {
            action: "LEAVE_REQUEST_APPROVE",
            entityType: "LeaveRequest",
            userId: undefined,
            userEmail: "admin@thainhf.org",
            details: {
                before: { status: "PENDING" },
                after: { status: "APPROVED" },
                metadata: {
                    ...details.metadata,
                    leaveRequestId: "clx_leave_request_123",
                },
            },
        });
    });

    it("propagates Audit failure to the enclosing strict transaction", async () => {
        const error = new Error("audit failed");
        vi.mocked(appendAuditInTransaction).mockRejectedValue(error);

        await expect(createLeaveAuditInTransaction(
            transaction,
            "LEAVE_REQUEST_APPROVE",
            "clx_leave_request_123",
            99,
            "admin@thainhf.org",
            details,
        )).rejects.toBe(error);
    });
});
