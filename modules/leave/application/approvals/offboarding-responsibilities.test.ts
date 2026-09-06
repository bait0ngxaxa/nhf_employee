import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getEmployeeLeaveOffboardingBlockers } from "./offboarding-responsibilities";

describe("Leave offboarding responsibilities", () => {
    it("keeps Leave-owned blocker states inside the caller transaction", async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const tx = { leaveRequest: { findMany } } as unknown as Prisma.TransactionClient;

        await getEmployeeLeaveOffboardingBlockers(tx, 17);

        expect(findMany).toHaveBeenCalledWith({
            where: {
                OR: [{ approverId: 17 }, { exceptionApproverId: 17 }],
                AND: [{
                    OR: [
                        { status: "PENDING" },
                        { status: "CANCELLATION_REQUESTED" },
                        { status: "APPROVED", notTakenRequestedAt: { not: null } },
                    ],
                }],
            },
            select: {
                id: true,
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        nickname: true,
                    },
                },
            },
            orderBy: { id: "asc" },
        });
    });
});
