import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { createRoutineTask } from "./mutations";
import { createRoutineTaskRequestHash } from "./idempotency";

const assertActiveRoutineActorMock = vi.hoisted(() => vi.fn());
const resolveRoutineCapabilityInTransactionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    hasPrismaErrorCode: (error: unknown, code: string) =>
        typeof error === "object" && error !== null && "code" in error && error.code === code,
    runSerializableTransaction: vi.fn(async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prisma as unknown as Prisma.TransactionClient)),
}));

vi.mock("./authorization", () => ({
    assertActiveRoutineActorInTransaction: assertActiveRoutineActorMock,
    resolveRoutineCapabilityInTransaction: resolveRoutineCapabilityInTransactionMock,
    assertActiveEmployeesInTransaction: vi.fn(),
}));

vi.mock("./audit", () => ({
    createRoutineAuditInTransaction: vi.fn(),
}));

vi.mock("./generation", () => ({
    generateRoutineTaskOccurrencesInTransaction: vi.fn(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

const input = {
    unitId: 1,
    categoryId: 1,
    title: "ตรวจสอบระบบ",
    description: null,
    scheduleType: "MONTHLY_DAY" as const,
    scheduleConfig: { day: 10, monthOffset: 0 },
    scheduleText: null,
    contractStartDate: null,
    contractEndDate: null,
    contractText: null,
    extraDetails: null,
    businessDayPolicy: "NONE" as const,
    isActive: true,
    assignees: [{ employeeId: 11, role: "OWNER" as const }],
    reminderRules: [],
};

const actor = { id: 99, role: "ADMIN", email: "admin@example.com" };

const task = {
    id: 71,
    unitId: 1,
    categoryId: 1,
    title: "ตรวจสอบระบบ",
};

describe("Routine task create idempotency", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        assertActiveRoutineActorMock.mockResolvedValue({
            authorizationActor: {
                userId: 99,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
            employeeId: null,
        });
        resolveRoutineCapabilityInTransactionMock.mockResolvedValue({
            actor: {
                userId: 99,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
            capability: "routine.task.create",
            decision: {
                capability: "routine.task.create",
                allowed: true,
                scopes: ["ALL"],
                grants: [],
            },
            defaultScopes: [],
            scopes: ["ALL"],
            hasBroadAuthority: true,
            liffSelfServicePolicyApplied: false,
        });
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(null));
        prismaMock.routineTask.findUniqueOrThrow.mockResolvedValue(asNever(task));
        prismaMock.routineTask.create.mockResolvedValue(asNever(task));
        prismaMock.routineUnit.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 11 }]));
        prismaMock.routineTaskCreateIdempotency.findUnique.mockResolvedValue(null);
        prismaMock.routineTaskCreateIdempotency.create.mockResolvedValue(asNever({
            id: "idem-1",
            userId: 99,
            idempotencyKey: "key-1",
            requestHash: "hash",
            taskId: 71,
        }));
    });

    it("replays the existing task without invoking create again", async () => {
        const first = await createRoutineTask(input, actor, { idempotencyKey: "key-1" });
        prismaMock.routineTaskCreateIdempotency.findUnique.mockResolvedValue(asNever({
            id: "idem-1",
            userId: 99,
            idempotencyKey: "key-1",
            requestHash: createRoutineTaskRequestHash(input),
            taskId: 71,
        }));
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(task));
        const second = await createRoutineTask(input, actor, { idempotencyKey: "key-1" });

        expect(first.replayed).toBe(false);
        expect(second).toMatchObject({ replayed: true, task: { id: 71 } });
        expect(prismaMock.routineTask.create).toHaveBeenCalledTimes(1);
    });

    it("rejects reusing a key with a different payload", async () => {
        prismaMock.routineTaskCreateIdempotency.findUnique.mockResolvedValue(asNever({
            id: "idem-1",
            userId: 99,
            idempotencyKey: "key-1",
            requestHash: "different-request",
            taskId: 71,
        }));

        await expect(createRoutineTask(input, actor, { idempotencyKey: "key-1" }))
            .rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
        expect(prismaMock.routineTask.create).not.toHaveBeenCalled();
    });

    it("resolves a concurrent idempotency unique conflict to the committed task", async () => {
        prismaMock.routineTaskCreateIdempotency.create.mockRejectedValueOnce(
            asNever({ code: "P2002" }),
        );
        const existing = {
            id: "idem-1",
            userId: 99,
            idempotencyKey: "key-1",
            requestHash: createRoutineTaskRequestHash(input),
            taskId: 71,
        };
        prismaMock.routineTaskCreateIdempotency.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValue(existing as never);
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(task));

        const result = await createRoutineTask(input, actor, { idempotencyKey: "key-1" });

        expect(result.replayed).toBe(true);
        expect(result.task).toMatchObject({ id: 71 });
    });

    it("hashes the canonical self-service payload instead of spoofed fields", async () => {
        const userActor = { id: 3, role: "USER", email: "user@example.com" };
        const spoofedInput = {
            ...input,
            assignees: [{ employeeId: 999, role: "OWNER" as const }],
            sourceFileName: "spoof.xlsx",
            sourceSheet: "Sheet1",
            sourceRow: 12,
            reminderRules: [{
                daysBefore: 1,
                sendHour: 9,
                channel: "IN_APP" as const,
                recipientScope: "ALL_READERS" as const,
                isActive: true,
            }],
        };
        assertActiveRoutineActorMock.mockResolvedValue({
            authorizationActor: {
                userId: 3,
                employeeId: 11,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            employeeId: 11,
        });
        resolveRoutineCapabilityInTransactionMock.mockResolvedValue({
            actor: {
                userId: 3,
                employeeId: 11,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            capability: "routine.task.create",
            decision: {
                capability: "routine.task.create",
                allowed: true,
                scopes: ["OWN"],
                grants: [],
            },
            defaultScopes: ["OWN"],
            scopes: ["OWN"],
            hasBroadAuthority: false,
            liffSelfServicePolicyApplied: false,
        });

        await createRoutineTask(spoofedInput, userActor, {
            idempotencyKey: "self-service-key",
        });

        const expectedCanonicalInput = {
            ...spoofedInput,
            assignees: [{ employeeId: 11, role: "OWNER" as const }],
            sourceFileName: undefined,
            sourceSheet: undefined,
            sourceRow: undefined,
            reminderRules: [{
                daysBefore: 1,
                sendHour: 9,
                channel: "IN_APP" as const,
                recipientScope: "ASSIGNEES" as const,
                isActive: true,
            }],
        };
        expect(prismaMock.routineTaskCreateIdempotency.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 3,
                requestHash: createRoutineTaskRequestHash(expectedCanonicalInput),
            }),
        });
        expect(prismaMock.routineTask.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                createdById: 3,
                updatedById: 3,
                sourceFileName: null,
                sourceSheet: null,
                sourceRow: null,
                assignees: { create: [{ employeeId: 11, role: "OWNER" }] },
                reminderRules: {
                    create: [{
                        daysBefore: 1,
                        sendHour: 9,
                        channel: "IN_APP",
                        recipientScope: "ASSIGNEES",
                        isActive: true,
                    }],
                },
            }),
        });
    });

    it("does not hash normal task-create requests differently for spoofed provenance under ALL", async () => {
        const userActor = { id: 3, role: "USER", email: "user@example.com" };
        const commonInput = {
            ...input,
            assignees: [{ employeeId: 999, role: "OWNER" as const }],
            reminderRules: [{
                daysBefore: 1,
                sendHour: 9,
                channel: "IN_APP" as const,
                recipientScope: "ALL_READERS" as const,
                isActive: true,
            }],
        };
        const firstInput = {
            ...commonInput,
            sourceFileName: "spoof-a.xlsx",
            sourceSheet: "Spoof A",
            sourceRow: 12,
        };
        const secondInput = {
            ...commonInput,
            sourceFileName: "spoof-b.xlsx",
            sourceSheet: "Spoof B",
            sourceRow: 13,
        };
        assertActiveRoutineActorMock.mockResolvedValue({
            authorizationActor: {
                userId: 3,
                employeeId: 11,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            employeeId: 11,
        });
        resolveRoutineCapabilityInTransactionMock.mockResolvedValue({
            actor: {
                userId: 3,
                employeeId: 11,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            capability: "routine.task.create",
            decision: {
                capability: "routine.task.create",
                allowed: true,
                scopes: ["ALL"],
                grants: [{
                    capability: "routine.task.create",
                    scope: "ALL",
                    source: { type: "USER", userId: 3 },
                }],
            },
            defaultScopes: ["OWN"],
            scopes: ["ALL"],
            hasBroadAuthority: true,
            liffSelfServicePolicyApplied: false,
        });

        await createRoutineTask(firstInput, userActor, {
            idempotencyKey: "broad-provenance-a",
        });
        await createRoutineTask(secondInput, userActor, {
            idempotencyKey: "broad-provenance-b",
        });

        const idempotencyCalls = prismaMock.routineTaskCreateIdempotency.create.mock.calls;
        expect(idempotencyCalls).toHaveLength(2);
        expect(idempotencyCalls[0]?.[0]?.data.requestHash).toBe(
            idempotencyCalls[1]?.[0]?.data.requestHash,
        );
        expect(prismaMock.routineTask.create).toHaveBeenCalledTimes(2);
        for (const call of prismaMock.routineTask.create.mock.calls) {
            expect(call[0]?.data).toMatchObject({
                sourceFileName: null,
                sourceSheet: null,
                sourceRow: null,
            });
        }
    });
});
