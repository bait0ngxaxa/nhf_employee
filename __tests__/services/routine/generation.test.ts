import { beforeEach, describe, expect, it, vi } from "vitest";
import { type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { generateRoutineTaskOccurrences } from "@/lib/services/routine/generation";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: vi.fn(async (
        callback: (tx: PrismaClient) => unknown,
    ) => callback(prisma as unknown as PrismaClient)),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function activeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 71,
        isActive: true,
        scheduleType: "MONTHLY_DAY",
        scheduleConfig: { day: 10, monthOffset: 0 },
        businessDayPolicy: "NONE",
        version: 4,
        contractStartDate: null,
        contractEndDate: null,
        assignees: [
            { employeeId: 11, role: "OWNER" },
            { employeeId: 12, role: "CO_OWNER" },
        ],
        ...overrides,
    };
}

describe("NHF Routine occurrence generation", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask()),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(null);
        prismaMock.routineOccurrence.upsert.mockResolvedValue(
            asNever({ id: 1 }),
        );
    });

    it("generates the current month and two-month horizon once", async () => {
        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 3, created: 3, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledTimes(3);
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: { taskId_periodKey: { taskId: 71, periodKey: "2026-01" } },
                create: expect.objectContaining({
                    dueDate: new Date("2026-01-10T00:00:00.000Z"),
                    scheduleVersion: 4,
                    assignees: {
                        create: [
                            { employeeId: 11, role: "OWNER" },
                            { employeeId: 12, role: "CO_OWNER" },
                        ],
                    },
                }),
            }),
        );
    });

    it("is idempotent when all generated periods already exist", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever({ id: 100 }),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 3, created: 0, existing: 3 });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("treats a concurrent unique-constraint race as an existing occurrence", async () => {
        prismaMock.routineOccurrence.upsert.mockRejectedValueOnce(
            asNever({
                code: "P2002",
                meta: { target: ["taskId", "periodKey"] },
            }),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 3, created: 2, existing: 1 });
    });

    it.each([
        ["inactive", { isActive: false }],
        ["manual", { scheduleType: "MANUAL", scheduleConfig: {} }],
    ])("does not generate a %s task", async (_label, overrides) => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask(overrides)),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 0, created: 0, existing: 0 });
        expect(prismaMock.routineOccurrence.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("does not generate an occurrence after the contract end date", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                contractEndDate: new Date("2026-02-15T00:00:00.000Z"),
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 2, created: 2, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledTimes(2);
    });
});
