import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    isActiveEmployeeInTransaction,
} from "@/lib/services/leave/active-employee-session";
import { assignLeaveApprovers } from "@/lib/services/leave/approver-assignment";
import { buildLeaveActionDeliveryIdentity } from "@/lib/services/leave/notification-payloads";
import { runSerializableTransaction } from "@/lib/services/leave/transaction";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
    },
}));

type Deferred = {
    promise: Promise<void>;
    resolve: () => void;
};

type LeaveState = {
    managerId: number;
    managerUserId: number;
    pending: boolean;
    outbox: { approverId: number; deliveryIdentity: string } | null;
};

type TestTransaction = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
    user: { findFirst: (args: unknown) => Promise<{ id: number } | null> };
    employee: {
        findUnique: (args: unknown) => Promise<unknown>;
        findMany: (args: unknown) => Promise<unknown[]>;
        update: (args: unknown) => Promise<unknown>;
    };
    leaveRequest: {
        findMany: (args: unknown) => Promise<unknown[]>;
        create: (args: unknown) => Promise<{ id: string }>;
    };
    notificationOutbox: { create: (args: unknown) => Promise<unknown> };
    auditLog: { create: (args: unknown) => Promise<unknown> };
};

function deferred(): Deferred {
    let resolvePromise: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function createHarness(options: {
    requestCreated?: { signal: Deferred; release: Deferred };
    assignmentUpdated?: { signal: Deferred; release: Deferred };
} = {}) {
    const state: LeaveState = {
        managerId: 20,
        managerUserId: 200,
        pending: false,
        outbox: null,
    };
    let lockedBy: string | null = null;
    const waiters: Array<{ owner: string; signal: Deferred }> = [];
    const owners: string[] = [];

    const acquire = async (owner: string): Promise<void> => {
        if (lockedBy === null) {
            lockedBy = owner;
            return;
        }
        const waiter = { owner, signal: deferred() };
        waiters.push(waiter);
        await waiter.signal.promise;
        lockedBy = owner;
    };

    const release = (owner: string): void => {
        if (lockedBy !== owner) throw new Error("row lock owner mismatch");
        const waiter = waiters.shift();
        if (waiter) waiter.signal.resolve();
        else lockedBy = null;
    };

    const approver = (id: number) => ({
        id,
        firstName: `Manager ${id}`,
        lastName: "User",
        email: `manager-${id}@thainhf.org`,
        status: "ACTIVE",
        deletedAt: null,
        user: {
            id: id * 10,
            email: `manager-${id}@thainhf.org`,
            isActive: true,
            deletedAt: null,
        },
    });

    const createTransaction = (owner: string): TestTransaction => ({
        $queryRaw: async () => {
            await acquire(owner);
            return [];
        },
        user: {
            findFirst: async () => ({ id: owner === "request" ? 10 : 900 }),
        },
        employee: {
            findUnique: async () => ({
                id: 10,
                firstName: "Employee",
                lastName: "One",
                email: "employee@thainhf.org",
                managerId: state.managerId,
                user: { id: 10 },
                manager: approver(state.managerId),
            }),
            findMany: async (args: unknown) => {
                const where = isRecord(args) && isRecord(args.where) ? args.where : {};
                const ids = isRecord(where.id) && Array.isArray(where.id.in)
                    ? where.id.in.filter((id): id is number => typeof id === "number")
                    : [];
                if (ids.length > 0 && ids[0] === 10) {
                    return [{ id: 10, firstName: "Employee", lastName: "One", managerId: state.managerId }];
                }
                return ids.map((id) => approver(id));
            },
            update: async (args: unknown) => {
                if (!isRecord(args) || !isRecord(args.data)) throw new Error("invalid update");
                const managerId = args.data.managerId;
                if (typeof managerId !== "number") throw new Error("invalid manager");
                state.managerId = managerId;
                state.managerUserId = managerId * 10;
                if (options.assignmentUpdated) {
                    options.assignmentUpdated.signal.resolve();
                    await options.assignmentUpdated.release.promise;
                }
                return { id: 10 };
            },
        },
        leaveRequest: {
            findMany: async () => state.pending
                ? [{ employeeId: 10, employee: { firstName: "Employee", lastName: "One" } }]
                : [],
            create: async (args: unknown) => {
                if (!isRecord(args) || !isRecord(args.data)) throw new Error("invalid request");
                const approverId = args.data.approverId;
                if (typeof approverId !== "number") throw new Error("invalid approver");
                state.pending = true;
                if (options.requestCreated) {
                    options.requestCreated.signal.resolve();
                    await options.requestCreated.release.promise;
                }
                return { id: "leave-1" };
            },
        },
        notificationOutbox: {
            create: async (args: unknown) => {
                if (!isRecord(args) || !isRecord(args.data)) throw new Error("invalid outbox");
                const payload = JSON.parse(String(args.data.payload)) as unknown;
                if (!isRecord(payload) || typeof payload.deliveryIdentity !== "string") {
                    throw new Error("invalid payload");
                }
                const approverId = state.managerId;
                state.outbox = { approverId, deliveryIdentity: payload.deliveryIdentity };
                return { id: 1 };
            },
        },
        auditLog: { create: async () => ({ id: 1 }) },
    });

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const owner = owners.shift();
        if (!owner) throw new Error("transaction owner was not queued");
        try {
            return await callback(createTransaction(owner) as never);
        } finally {
            release(owner);
        }
    });

    const queueOwner = (owner: string): void => {
        owners.push(owner);
    };

    return { state, queueOwner };
}

async function createLeaveRequest(harness: ReturnType<typeof createHarness>): Promise<void> {
    harness.queueOwner("request");
    await runSerializableTransaction(async (tx) => {
        if (!await isActiveEmployeeInTransaction(tx, 10, 10)) throw new Error("inactive employee");
        const testTx = tx as unknown as TestTransaction;
        const employee = await testTx.employee.findUnique({ where: { id: 10 } });
        if (!isRecord(employee) || typeof employee.managerId !== "number") throw new Error("manager missing");
        const manager = isRecord(employee.manager) ? employee.manager : null;
        const managerUser = manager && isRecord(manager.user) ? manager.user : null;
        if (!managerUser || typeof managerUser.id !== "number") throw new Error("manager user missing");
        const leaveRequest = await testTx.leaveRequest.create({ data: { approverId: employee.managerId } });
        await testTx.notificationOutbox.create({
            data: {
                type: "LEAVE_ACTION",
                payload: JSON.stringify({
                    leaveId: leaveRequest.id,
                    deliveryIdentity: buildLeaveActionDeliveryIdentity(
                        leaveRequest.id,
                        managerUser.id,
                    ),
                }),
            },
        });
    });
}

describe("leave request and manager reassignment serialization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("lets request creation win, then rejects reassignment on the committed PENDING request", async () => {
        const requestCreated = { signal: deferred(), release: deferred() };
        const harness = createHarness({ requestCreated });

        const requestPromise = createLeaveRequest(harness);
        await requestCreated.signal.promise;

        harness.queueOwner("assignment");
        const assignmentPromise = assignLeaveApprovers(
            [{ employeeId: 10, managerId: 30 }],
            { userId: 1, email: "admin@thainhf.org" },
        );
        requestCreated.release.resolve();

        await requestPromise;
        await expect(assignmentPromise).rejects.toMatchObject({ statusCode: 409 });
        expect(harness.state.pending).toBe(true);
        expect(harness.state.managerId).toBe(20);
        expect(harness.state.outbox?.approverId).toBe(20);
    });

    it("lets reassignment win, then creates the request for the new manager identity", async () => {
        const assignmentUpdated = { signal: deferred(), release: deferred() };
        const harness = createHarness({ assignmentUpdated });
        harness.queueOwner("assignment");
        const assignmentPromise = assignLeaveApprovers(
            [{ employeeId: 10, managerId: 30 }],
            { userId: 1, email: "admin@thainhf.org" },
        );
        await assignmentUpdated.signal.promise;

        const requestPromise = createLeaveRequest(harness);
        assignmentUpdated.release.resolve();

        await assignmentPromise;
        await requestPromise;
        expect(harness.state.managerId).toBe(30);
        expect(harness.state.pending).toBe(true);
        expect(harness.state.outbox).toEqual({
            approverId: 30,
            deliveryIdentity: "leave-1:300",
        });
    });
});
