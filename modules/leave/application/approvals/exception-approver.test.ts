import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    persistLeaveExceptionApprover,
    resolveLeaveExceptionApprover,
} from "./exception-approver";
import { buildLeaveActionDeliveryIdentity } from "../notifications/notification-payloads";
import { lockLeaveRequestRow } from "../../infrastructure/persistence/transaction";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        employee: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        leaveRequest: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

function buildAdmin(id: number) {
    return {
        id,
        firstName: `Admin ${id}`,
        lastName: "Recovery",
        nickname: null,
        email: `admin${id}@example.com`,
        status: "ACTIVE" as const,
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

    it("creates a new persisted generation when the effective approver leaves and returns", async () => {
        const leaveId = "leave-generation";
        const originalApprover = buildAdmin(30);
        const unavailableOriginalApprover = {
            ...originalApprover,
            status: "INACTIVE" as const,
            user: null,
        };
        const recoveryApprover = buildAdmin(40);
        const state = {
            approverId: 30,
            exceptionApproverId: null as number | null,
            approvalActionVersion: 1,
        };
        const firstAIdentity = buildLeaveActionDeliveryIdentity(
            leaveId,
            originalApprover.user.id,
            state.approvalActionVersion,
        );

        vi.mocked(prisma.employee.findUnique).mockResolvedValueOnce({
            manager: recoveryApprover,
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockImplementation((async () => ({
            approverId: state.approverId,
            exceptionApproverId: state.exceptionApproverId,
        }) as never) as never);
        vi.mocked(prisma.leaveRequest.update).mockImplementation((async ({ data }: { data: unknown }) => {
            const updateData = data as {
                exceptionApproverId?: number | null;
                approvalActionVersion?: { increment: number };
            };
            state.exceptionApproverId = updateData.exceptionApproverId ?? null;
            if (updateData.approvalActionVersion?.increment) {
                state.approvalActionVersion += updateData.approvalActionVersion.increment;
            }
            return state;
        }) as never);

        const firstResolution = await resolveLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            {
                employeeId: 10,
                originalApprover: unavailableOriginalApprover,
                existingApprover: null,
                reuseExisting: false,
            },
        );
        if (!firstResolution) throw new Error("Expected recovery approver");
        await persistLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            leaveId,
            firstResolution,
        );
        const bIdentity = buildLeaveActionDeliveryIdentity(
            leaveId,
            recoveryApprover.user.id,
            state.approvalActionVersion,
        );

        const secondResolution = await resolveLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            {
                employeeId: 10,
                originalApprover,
                existingApprover: recoveryApprover,
                reuseExisting: false,
            },
        );
        if (!secondResolution) throw new Error("Expected original approver");
        await persistLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            leaveId,
            secondResolution,
        );
        const secondAIdentity = buildLeaveActionDeliveryIdentity(
            leaveId,
            originalApprover.user.id,
            state.approvalActionVersion,
        );

        expect(state).toEqual({
            approverId: 30,
            exceptionApproverId: null,
            approvalActionVersion: 3,
        });
        expect(firstAIdentity).not.toBe(secondAIdentity);
        expect(firstAIdentity).not.toBe(bIdentity);
        expect(bIdentity).not.toBe(secondAIdentity);
        expect(prisma.leaveRequest.update).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                data: expect.objectContaining({
                    approvalActionVersion: { increment: 1 },
                }),
            }),
        );
        expect(prisma.leaveRequest.update).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                data: expect.objectContaining({
                    approvalActionVersion: { increment: 1 },
                }),
            }),
        );
    });

    it("does not increment when recovery reselects the same effective approver", async () => {
        const recoveryApprover = buildAdmin(40);
        const state = {
            approverId: 30,
            exceptionApproverId: recoveryApprover.id,
            approvalActionVersion: 2,
        };
        const unavailableOriginalApprover = {
            ...buildAdmin(30),
            status: "INACTIVE" as const,
            user: null,
        };

        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            manager: recoveryApprover,
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            approverId: state.approverId,
            exceptionApproverId: state.exceptionApproverId,
        } as never);
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue(state as never);

        const resolution = await resolveLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            {
                employeeId: 10,
                originalApprover: unavailableOriginalApprover,
                existingApprover: recoveryApprover,
                reuseExisting: false,
            },
        );
        if (!resolution) throw new Error("Expected recovery approver");

        await persistLeaveExceptionApprover(
            prisma as unknown as Prisma.TransactionClient,
            "leave-same-assignment",
            resolution,
        );

        expect(state.approvalActionVersion).toBe(2);
        const updateCall = vi.mocked(prisma.leaveRequest.update).mock.calls[0]?.[0];
        expect(updateCall?.data).not.toHaveProperty("approvalActionVersion");
    });

    it("serializes concurrent retries of the same reassignment without double incrementing", async () => {
        const recoveryApprover = buildAdmin(40);
        const state = {
            approverId: 30,
            exceptionApproverId: null as number | null,
            approvalActionVersion: 1,
        };
        let lockHeld = false;
        const waiters: Array<() => void> = [];
        const tx = {
            $queryRaw: async (): Promise<unknown[]> => {
                if (!lockHeld) {
                    lockHeld = true;
                    return [];
                }
                await new Promise<void>((resolve) => {
                    waiters.push(() => {
                        lockHeld = true;
                        resolve();
                    });
                });
                return [];
            },
            leaveRequest: {
                findUnique: async () => ({
                    approverId: state.approverId,
                    exceptionApproverId: state.exceptionApproverId,
                }),
                update: async ({ data }: { data: unknown }) => {
                    const updateData = data as {
                        exceptionApproverId?: number | null;
                        approvalActionVersion?: { increment: number };
                    };
                    state.exceptionApproverId = updateData.exceptionApproverId ?? null;
                    state.approvalActionVersion += updateData.approvalActionVersion?.increment ?? 0;
                    return state;
                },
            },
        } as unknown as Prisma.TransactionClient;
        const resolution = {
            approver: recoveryApprover,
            source: "CURRENT_MANAGER" as const,
            exceptionApproverId: recoveryApprover.id,
            assignedAt: new Date(),
            shouldPersist: true,
        };

        const persistWithLock = async (): Promise<void> => {
            await lockLeaveRequestRow(tx, "leave-concurrent");
            try {
                await persistLeaveExceptionApprover(tx, "leave-concurrent", resolution);
            } finally {
                const next = waiters.shift();
                if (next) next();
                else lockHeld = false;
            }
        };

        await Promise.all([persistWithLock(), persistWithLock()]);

        expect(state).toEqual({
            approverId: 30,
            exceptionApproverId: 40,
            approvalActionVersion: 2,
        });
    });
});
