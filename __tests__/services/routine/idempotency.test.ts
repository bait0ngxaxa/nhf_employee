import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { createRoutineTask } from "@/lib/services/routine/mutations";
import { createRoutineTaskRequestHash } from "@/lib/services/routine/idempotency";

const assertActiveRoutineActorMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/services/routine/authorization", () => ({
    assertActiveAdminInTransaction: vi.fn(),
    assertActiveRoutineActorInTransaction: assertActiveRoutineActorMock,
    assertActiveEmployeesInTransaction: vi.fn(),
}));

vi.mock("@/lib/services/routine/audit", () => ({
    createRoutineAuditInTransaction: vi.fn(),
}));

vi.mock("@/lib/services/routine/generation", () => ({
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
            isAdmin: true,
            employeeId: null,
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
                recipientScope: "ADMINS" as const,
                isActive: true,
            }],
        };
        assertActiveRoutineActorMock.mockResolvedValue({
            isAdmin: false,
            employeeId: 11,
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
});
