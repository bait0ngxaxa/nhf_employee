import { beforeEach, describe, expect, it, vi } from "vitest";

import { emailService } from "@/lib/email";
import { prisma } from "@/lib/db/prisma";
import { dispatchCurrentLeaveAction } from "@/lib/services/leave/current-action-recipient";
import { lockLeaveRequestRow, runSerializableTransaction } from "@/lib/services/leave/transaction";
import type { LeaveActionPayload } from "@/lib/services/leave/notification-payloads";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/email", () => ({
    emailService: {
        sendLeaveActionNotification: vi.fn(),
    },
}));

type Deferred = { promise: Promise<void>; resolve: () => void };
type Notification = { type: string; isRead: boolean };
type State = {
    requestStatus: "PENDING" | "CANCELLED";
    outboxStatus: "PROCESSING" | "SENT" | "SUPERSEDED";
    notifications: Notification[];
};

type TestTransaction = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
    notificationOutbox: {
        findFirst: (args: unknown) => Promise<{ id: number } | null>;
        updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    leaveRequest: {
        findUnique: (args: unknown) => Promise<unknown>;
        updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    notification: {
        create: (args: unknown) => Promise<unknown>;
        updateMany: (args: unknown) => Promise<{ count: number }>;
    };
};

function deferred(): Deferred {
    let resolvePromise: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}

function buildPayload(): LeaveActionPayload {
    return {
        leaveId: "leave-1",
        deliveryIdentity: "leave-1:200",
        employee: {
            employeeId: 10,
            userId: 10,
            email: "employee@thainhf.org",
            name: "Employee One",
        },
        approver: {
            employeeId: 20,
            userId: 200,
            email: "manager@thainhf.org",
            name: "Manager One",
        },
        leaveType: "VACATION",
        startDate: "2031-05-05T00:00:00.000Z",
        endDate: "2031-05-05T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "พักร้อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
    };
}

function createHarness(options: {
    workerCreated?: { signal: Deferred; release: Deferred };
    cancelUpdated?: { signal: Deferred; release: Deferred };
} = {}) {
    const state: State = {
        requestStatus: "PENDING",
        outboxStatus: "PROCESSING",
        notifications: [],
    };
    let locked = false;
    const waiters: Deferred[] = [];
    const owners: string[] = [];

    const acquire = async (): Promise<void> => {
        if (!locked) {
            locked = true;
            return;
        }
        const waiter = deferred();
        waiters.push(waiter);
        await waiter.promise;
        locked = true;
    };

    const release = (): void => {
        const waiter = waiters.shift();
        if (waiter) waiter.resolve();
        else locked = false;
    };

    const tx = (owner: string): TestTransaction => ({
        $queryRaw: async () => {
            await acquire();
            return [];
        },
        notificationOutbox: {
            findFirst: async () => state.outboxStatus === "PROCESSING" ? { id: 100 } : null,
            updateMany: async (args: unknown) => {
                if (owner !== "worker") return { count: 0 };
                state.outboxStatus = "SUPERSEDED";
                return args ? { count: 1 } : { count: 0 };
            },
        },
        leaveRequest: {
            findUnique: async () => ({
                status: state.requestStatus,
                approver: {
                    id: 20,
                    firstName: "Manager",
                    lastName: "One",
                    email: "manager@thainhf.org",
                    status: "ACTIVE",
                    deletedAt: null,
                    user: {
                        id: 200,
                        email: "manager@thainhf.org",
                        isActive: true,
                        deletedAt: null,
                    },
                },
            }),
            updateMany: async () => {
                if (owner !== "cancel") return { count: 0 };
                state.requestStatus = "CANCELLED";
                if (options.cancelUpdated) {
                    options.cancelUpdated.signal.resolve();
                    await options.cancelUpdated.release.promise;
                }
                return { count: 1 };
            },
        },
        notification: {
            create: async () => {
                state.notifications.push({ type: "LEAVE_REQUESTED", isRead: false });
                if (options.workerCreated) {
                    options.workerCreated.signal.resolve();
                    await options.workerCreated.release.promise;
                }
                return { id: "notification-1" };
            },
            updateMany: async () => {
                for (const notification of state.notifications) {
                    if (notification.type === "LEAVE_REQUESTED") notification.isRead = true;
                }
                return { count: 1 };
            },
        },
    });

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const owner = owners.shift();
        if (!owner) throw new Error("transaction owner was not queued");
        try {
            return await callback(tx(owner) as never);
        } finally {
            release();
        }
    });

    const queue = (owner: string): void => {
        owners.push(owner);
    };
    return { state, queue };
}

async function cancelRequest(harness: ReturnType<typeof createHarness>): Promise<void> {
    harness.queue("cancel");
    await runSerializableTransaction(async (transaction) => {
        await lockLeaveRequestRow(transaction, "leave-1");
        const tx = transaction as never as TestTransaction;
        const request = await tx.leaveRequest.findUnique({ where: { id: "leave-1" } });
        if (!request) throw new Error("request missing");
        await tx.leaveRequest.updateMany({
            where: { id: "leave-1", status: "PENDING" },
            data: { status: "CANCELLED" },
        });
        await tx.notification.updateMany({
            where: { type: "LEAVE_REQUESTED", referenceId: "leave-1", isRead: false },
            data: { isRead: true },
        });
    });
}

describe("LEAVE_ACTION worker and cancellation serialization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(emailService.sendLeaveActionNotification).mockResolvedValue(true);
    });

    it("lets the worker create the notification, then cancellation reads it and marks it read", async () => {
        const workerCreated = { signal: deferred(), release: deferred() };
        const harness = createHarness({ workerCreated });
        const payload = buildPayload();
        harness.queue("worker");
        const workerPromise = dispatchCurrentLeaveAction(100, payload);
        await workerCreated.signal.promise;

        const cancelPromise = cancelRequest(harness);
        workerCreated.release.resolve();
        const workerResult = await workerPromise;
        await cancelPromise;
        if (workerResult === "SENT") harness.state.outboxStatus = "SENT";

        expect(workerResult).toBe("SENT");
        expect(harness.state.requestStatus).toBe("CANCELLED");
        expect(harness.state.notifications).toEqual([{ type: "LEAVE_REQUESTED", isRead: true }]);
        expect(harness.state.notifications.some((notification) => !notification.isRead)).toBe(false);
        expect(harness.state.outboxStatus).toBe("SENT");
        expect(emailService.sendLeaveActionNotification).toHaveBeenCalledTimes(1);
    });

    it("lets cancellation commit first, so the worker supersedes the stale outbox without email", async () => {
        const cancelUpdated = { signal: deferred(), release: deferred() };
        const harness = createHarness({ cancelUpdated });
        const payload = buildPayload();
        const cancelPromise = cancelRequest(harness);
        await cancelUpdated.signal.promise;

        harness.queue("worker");
        const workerPromise = dispatchCurrentLeaveAction(100, payload);
        cancelUpdated.release.resolve();
        await cancelPromise;
        const workerResult = await workerPromise;

        expect(workerResult).toBe("SUPERSEDED");
        expect(harness.state.requestStatus).toBe("CANCELLED");
        expect(harness.state.outboxStatus).toBe("SUPERSEDED");
        expect(harness.state.notifications).toEqual([]);
        expect(emailService.sendLeaveActionNotification).not.toHaveBeenCalled();
    });
});
