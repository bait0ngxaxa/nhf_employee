import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { resolveLeaveExceptionApprover } from "@/lib/services/leave/exception-approver";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        employee: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

function buildAdmin(id: number) {
    return {
        id,
        firstName: `Admin ${id}`,
        lastName: "Recovery",
        email: `admin${id}@example.com`,
        status: "ACTIVE",
        deletedAt: null,
        user: {
            id,
            email: `admin${id}@example.com`,
            isActive: true,
            deletedAt: null,
        },
    };
}

describe("resolveLeaveExceptionApprover", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({ manager: null } as never);
    });

    it("excludes the leave owner from admin fallback selection", async () => {
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            buildAdmin(20),
        ] as never);

        const result = await resolveLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            {
                employeeId: 10,
                originalApprover: {
                    id: 30,
                    firstName: "Former",
                    lastName: "Manager",
                    nickname: null,
                    email: "former@example.com",
                    status: "INACTIVE",
                    deletedAt: null,
                    user: null,
                },
                existingApprover: null,
                reuseExisting: false,
            },
        );

        expect(result?.approver.id).toBe(20);
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: { not: 10 },
            }),
        }));
    });
});
