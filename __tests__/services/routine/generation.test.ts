import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Prisma, type PrismaClient } from "@prisma/client";
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
        reminderRules: [],
        assignees: [
            { employeeId: 11, role: "OWNER" },
            { employeeId: 12, role: "CO_OWNER" },
        ],
        ...overrides,
    };
}

function generatedOccurrence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 100,
        periodKey: "2026-08",
        dueDate: new Date("2026-08-10T00:00:00.000Z"),
        originalDueDate: new Date("2026-08-10T00:00:00.000Z"),
        isDueDateOverridden: false,
        scheduleVersion: 3,
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
        prismaMock.routineOccurrence.findMany.mockResolvedValue([] as never);
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(null);
        prismaMock.routineOccurrence.upsert.mockResolvedValue(
            asNever({ id: 1 }),
        );
        prismaMock.routineOccurrence.deleteMany.mockResolvedValue(
            asNever({ count: 0 }),
        );
        prismaMock.routineOccurrenceAssignee.deleteMany.mockResolvedValue(
            asNever({ count: 0 }),
        );
        prismaMock.routineOccurrenceAssignee.createMany.mockResolvedValue(
            asNever({ count: 0 }),
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
                    isDueDateOverridden: false,
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
        expect(prismaMock.routineOccurrence.upsert.mock.calls[0]?.[0]?.create)
            .not.toHaveProperty("status");
    });

    it("extends generation for the largest active reminder rule", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "ONE_TIME",
                scheduleConfig: { date: "2027-08-04" },
                reminderRules: [
                    { daysBefore: 30 },
                    { daysBefore: 365 },
                ],
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 1, created: 1, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2027-08-04" },
                },
            }),
        );
    });

    it("materializes a weekend-shifted month-end before a 70-day reminder boundary", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MONTH_END",
                scheduleConfig: {},
                businessDayPolicy: "NEXT_BUSINESS_DAY",
                reminderRules: [{ daysBefore: 70 }],
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 3, created: 3, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2026-10" },
                },
                create: expect.objectContaining({
                    originalDueDate: new Date("2026-10-31T00:00:00.000Z"),
                    dueDate: new Date("2026-11-02T00:00:00.000Z"),
                }),
            }),
        );
    });

    it("is idempotent when a 365-day month-end horizon shifts into the next month", async () => {
        const now = new Date("2026-06-24T04:00:00.000Z");
        const existingOccurrences = [
            ["2026-05", "2026-05-31", "2026-06-01"],
            ["2026-06", "2026-06-30", "2026-06-30"],
            ["2026-07", "2026-07-31", "2026-07-31"],
            ["2026-08", "2026-08-31", "2026-08-31"],
            ["2026-09", "2026-09-30", "2026-09-30"],
            ["2026-10", "2026-10-31", "2026-11-02"],
            ["2026-11", "2026-11-30", "2026-11-30"],
            ["2026-12", "2026-12-31", "2026-12-31"],
            ["2027-01", "2027-01-31", "2027-02-01"],
            ["2027-02", "2027-02-28", "2027-03-01"],
            ["2027-03", "2027-03-31", "2027-03-31"],
            ["2027-04", "2027-04-30", "2027-04-30"],
            ["2027-05", "2027-05-31", "2027-05-31"],
            ["2027-06", "2027-06-30", "2027-06-30"],
            ["2027-07", "2027-07-31", "2027-08-02"],
        ].map(([periodKey, originalDueDate, dueDate], index) =>
            generatedOccurrence({
                id: 100 + index,
                periodKey,
                originalDueDate: new Date(`${originalDueDate}T00:00:00.000Z`),
                dueDate: new Date(`${dueDate}T00:00:00.000Z`),
            }),
        );

        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MONTH_END",
                scheduleConfig: {},
                businessDayPolicy: "NEXT_BUSINESS_DAY",
                reminderRules: [{ daysBefore: 365 }],
            })),
        );
        prismaMock.routineOccurrence.findFirst
            .mockResolvedValueOnce(asNever(null))
            .mockImplementationOnce((async (args?: Prisma.RoutineOccurrenceFindFirstArgs) => {
                const dueDateFilter = args?.where?.OR?.[0]?.dueDate;
                const safetyBound = dueDateFilter
                    && typeof dueDateFilter === "object"
                    && "gt" in dueDateFilter
                    && dueDateFilter.gt instanceof Date
                    ? dueDateFilter.gt
                    : null;
                if (
                    !safetyBound
                    || new Date("2027-08-02T00:00:00.000Z") <= safetyBound
                ) {
                    return null;
                }
                return asNever({
                    id: 113,
                    originalDueDate: new Date("2027-07-31T00:00:00.000Z"),
                    dueDate: new Date("2027-08-02T00:00:00.000Z"),
                });
            }) as never);
        prismaMock.routineOccurrence.findMany
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce(asNever(existingOccurrences));

        const initialResult = await generateRoutineTaskOccurrences(71, now);

        expect(initialResult).toEqual({ evaluated: 15, created: 15, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2027-07" },
                },
                create: expect.objectContaining({
                    originalDueDate: new Date("2027-07-31T00:00:00.000Z"),
                    dueDate: new Date("2027-08-02T00:00:00.000Z"),
                }),
            }),
        );
        prismaMock.routineOccurrence.upsert.mockClear();

        const repeatedResult = await generateRoutineTaskOccurrences(71, now);

        expect(repeatedResult).toEqual({ evaluated: 15, created: 0, existing: 15 });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("does not materialize a shifted occurrence beyond the contract end", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MONTH_END",
                scheduleConfig: {},
                businessDayPolicy: "NEXT_BUSINESS_DAY",
                contractEndDate: new Date("2026-10-31T00:00:00.000Z"),
                reminderRules: [{ daysBefore: 70 }],
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 2, created: 2, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2026-10" },
                },
            }),
        );
    });

    it("does not extend the window for an inactive reminder rule", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "ONE_TIME",
                scheduleConfig: { date: "2027-08-04" },
                reminderRules: [],
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 0, created: 0, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("generates the next yearly occurrence before a 365-day reminder", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "YEARLY_DATE",
                scheduleConfig: { month: 8, day: 4 },
                reminderRules: [{ daysBefore: 365 }],
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 2, created: 2, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2027-08" },
                },
            }),
        );
    });

    it("is idempotent when all generated periods already exist", async () => {
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                periodKey: "2026-01",
                dueDate: new Date("2026-01-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-01-10T00:00:00.000Z"),
                scheduleVersion: 4,
            }),
            generatedOccurrence({
                id: 101,
                periodKey: "2026-02",
                dueDate: new Date("2026-02-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-02-10T00:00:00.000Z"),
                scheduleVersion: 4,
            }),
            generatedOccurrence({
                id: 102,
                periodKey: "2026-03",
                dueDate: new Date("2026-03-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-03-10T00:00:00.000Z"),
                scheduleVersion: 4,
            }),
        ]));

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

    it("excludes past occurrences when importing a task", async () => {
        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
            { excludePastDue: true },
        );

        expect(result).toEqual({ evaluated: 3, created: 2, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledTimes(2);
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalledWith(
            expect.objectContaining({
                where: { taskId_periodKey: { taskId: 71, periodKey: "2026-01" } },
            }),
        );
    });

    it("refreshes schedule metadata without overwriting an admin due-date override", async () => {
        prismaMock.routineOccurrence.findUnique
            .mockResolvedValueOnce(asNever({
                id: 100,
                dueDate: new Date("2026-01-20T00:00:00.000Z"),
                originalDueDate: new Date("2026-01-10T00:00:00.000Z"),
                isDueDateOverridden: true,
                scheduleVersion: 3,
            }))
            .mockResolvedValue(null);
        prismaMock.routineOccurrence.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-01-15T04:00:00.000Z"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 100, scheduleVersion: 3 },
            data: {
                scheduleVersion: 4,
            },
        });
    });

    it("reconciles stale future monthly periods when changing to yearly", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "YEARLY_DATE",
                scheduleConfig: { month: 9, day: 15 },
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({ periodKey: "2026-08" }),
            generatedOccurrence({
                id: 101,
                periodKey: "2026-09",
                dueDate: new Date("2026-09-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-09-10T00:00:00.000Z"),
            }),
            generatedOccurrence({
                id: 102,
                periodKey: "2026-10",
                dueDate: new Date("2026-10-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-10-10T00:00:00.000Z"),
            }),
        ]));

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 1, created: 0, existing: 1 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({
            where: {
                taskId: 71,
                dueDate: {
                    gte: new Date("2026-08-04T00:00:00.000Z"),
                    lte: new Date("2026-10-31T00:00:00.000Z"),
                },
                periodKey: { notIn: ["2026-09"] },
            },
        });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("reconciles monthly periods when changing to a one-time schedule", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "ONE_TIME",
                scheduleConfig: { date: "2026-12-15" },
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({ periodKey: "2026-10" }),
            generatedOccurrence({
                id: 101,
                periodKey: "2026-11",
                dueDate: new Date("2026-11-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-11-10T00:00:00.000Z"),
            }),
            generatedOccurrence({
                id: 102,
                periodKey: "2026-12",
                dueDate: new Date("2026-12-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-12-10T00:00:00.000Z"),
            }),
        ]));

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-10-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 1, created: 1, existing: 0 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({
            where: {
                taskId: 71,
                dueDate: {
                    gte: new Date("2026-10-04T00:00:00.000Z"),
                    lte: new Date("2026-12-31T00:00:00.000Z"),
                },
                periodKey: { notIn: ["2026-12-15"] },
            },
        });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2026-12-15" },
                },
            }),
        );
    });

    it("removes every future occurrence when changing to manual", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MANUAL",
                scheduleConfig: {},
                version: 5,
            })),
        );

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 0, created: 0, existing: 0 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({
            where: {
                taskId: 71,
                dueDate: {
                    gte: new Date("2026-08-04T00:00:00.000Z"),
                },
            },
        });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("preserves a future occurrence and its overrides when the reminder horizon is reduced", async () => {
        const now = new Date("2026-08-04T04:00:00.000Z");
        prismaMock.routineTask.findUnique
            .mockResolvedValueOnce(asNever(activeTask({
                reminderRules: [{ daysBefore: 365 }],
                version: 4,
            })))
            .mockResolvedValueOnce(asNever(activeTask({
                reminderRules: [{ daysBefore: 7 }],
                version: 5,
            })));
        prismaMock.routineOccurrence.findMany
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce(asNever([
                generatedOccurrence({ periodKey: "2026-08" }),
                generatedOccurrence({
                    id: 101,
                    periodKey: "2027-08",
                    dueDate: new Date("2027-01-10T00:00:00.000Z"),
                    originalDueDate: new Date("2027-08-10T00:00:00.000Z"),
                    isDueDateOverridden: true,
                    assignees: [{ employeeId: 99, role: "OWNER" }],
                }),
            ]));

        const initialResult = await generateRoutineTaskOccurrences(71, now);

        expect(initialResult).toEqual({ evaluated: 13, created: 13, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2027-08" },
                },
            }),
        );

        prismaMock.routineOccurrence.deleteMany.mockClear();
        prismaMock.routineOccurrence.upsert.mockClear();

        const reducedHorizonResult = await generateRoutineTaskOccurrences(71, now);

        expect(reducedHorizonResult).toEqual({ evaluated: 3, created: 2, existing: 1 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                periodKey: expect.objectContaining({
                    notIn: expect.arrayContaining(["2027-08"]),
                }),
            }),
        });
    });

    it("refreshes a valid yearly occurrence beyond a reduced reminder horizon", async () => {
        const now = new Date("2026-08-04T04:00:00.000Z");
        prismaMock.routineTask.findUnique
            .mockResolvedValueOnce(asNever(activeTask({
                scheduleType: "YEARLY_DATE",
                scheduleConfig: { month: 8, day: 10 },
                reminderRules: [{ daysBefore: 365 }],
                version: 4,
            })))
            .mockResolvedValueOnce(asNever(activeTask({
                scheduleType: "YEARLY_DATE",
                scheduleConfig: { month: 8, day: 15 },
                reminderRules: [{ daysBefore: 7 }],
                version: 5,
            })));
        prismaMock.routineOccurrence.findMany
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce(asNever([
                generatedOccurrence({
                    periodKey: "2026-08",
                    dueDate: new Date("2026-08-10T00:00:00.000Z"),
                    originalDueDate: new Date("2026-08-10T00:00:00.000Z"),
                    scheduleVersion: 4,
                }),
                generatedOccurrence({
                    id: 101,
                    periodKey: "2027-08",
                    dueDate: new Date("2027-08-10T00:00:00.000Z"),
                    originalDueDate: new Date("2027-08-10T00:00:00.000Z"),
                    scheduleVersion: 4,
                }),
            ]));

        const initialResult = await generateRoutineTaskOccurrences(71, now);

        expect(initialResult).toEqual({ evaluated: 2, created: 2, existing: 0 });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2027-08" },
                },
            }),
        );
        prismaMock.routineOccurrence.updateMany.mockClear();
        prismaMock.routineOccurrence.upsert.mockClear();

        const result = await generateRoutineTaskOccurrences(71, now);

        expect(result).toEqual({ evaluated: 1, created: 0, existing: 1 });
        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 101, scheduleVersion: 4 },
            data: {
                scheduleVersion: 5,
                originalDueDate: new Date("2027-08-15T00:00:00.000Z"),
                dueDate: new Date("2027-08-15T00:00:00.000Z"),
                reminderVersion: { increment: 1 },
            },
        });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("refreshes a distant original date while preserving manual occurrence overrides", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "YEARLY_DATE",
                scheduleConfig: { month: 8, day: 15 },
                reminderRules: [{ daysBefore: 7 }],
                assignees: [{ employeeId: 21, role: "OWNER" }],
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                periodKey: "2026-08",
                dueDate: new Date("2026-08-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-08-10T00:00:00.000Z"),
                scheduleVersion: 4,
            }),
            generatedOccurrence({
                id: 101,
                periodKey: "2027-08",
                dueDate: new Date("2027-09-01T00:00:00.000Z"),
                originalDueDate: new Date("2027-08-10T00:00:00.000Z"),
                isDueDateOverridden: true,
                scheduleVersion: 4,
                assignees: [{ employeeId: 99, role: "OWNER" }],
            }),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
            {
                previousAssignees: [
                    { employeeId: 11, role: "OWNER" },
                    { employeeId: 12, role: "CO_OWNER" },
                ],
            },
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 101, scheduleVersion: 4 },
            data: {
                scheduleVersion: 5,
                originalDueDate: new Date("2027-08-15T00:00:00.000Z"),
                reminderVersion: { increment: 1 },
            },
        });
        expect(prismaMock.routineOccurrenceAssignee.deleteMany)
            .not.toHaveBeenCalledWith({ where: { occurrenceId: 101 } });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("preserves a previous-month occurrence moved into the future by an admin override", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MONTH_END",
                scheduleConfig: {},
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                periodKey: "2026-07",
                dueDate: new Date("2026-08-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-07-31T00:00:00.000Z"),
                isDueDateOverridden: true,
                assignees: [{ employeeId: 99, role: "OWNER" }],
            }),
        ]));

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-05T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 3, created: 3, existing: 0 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                periodKey: {
                    notIn: expect.arrayContaining(["2026-07"]),
                },
            }),
        });
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    taskId_periodKey: { taskId: 71, periodKey: "2026-07" },
                },
            }),
        );
        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 100, scheduleVersion: 3 },
            data: { scheduleVersion: 5 },
        });
        expect(prismaMock.routineOccurrenceAssignee.deleteMany)
            .not.toHaveBeenCalled();
    });

    it("preserves a manually moved occurrence when its period remains valid", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleConfig: { day: 10, monthOffset: 0 },
                reminderRules: [{ daysBefore: 365 }],
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                periodKey: "2027-08",
                dueDate: new Date("2027-01-10T00:00:00.000Z"),
                originalDueDate: new Date("2027-08-10T00:00:00.000Z"),
                isDueDateOverridden: true,
            }),
        ]));

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 13, created: 12, existing: 1 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                periodKey: {
                    notIn: expect.arrayContaining(["2027-08"]),
                },
            }),
        });
        expect(prismaMock.routineOccurrence.upsert).toHaveBeenCalledTimes(12);
    });

    it("fails closed when a future occurrence is outside the reconciliation safety bound", async () => {
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(asNever({
            id: 999,
            dueDate: new Date("2030-01-10T00:00:00.000Z"),
            originalDueDate: new Date("2030-01-10T00:00:00.000Z"),
        }));

        await expect(
            generateRoutineTaskOccurrences(
                71,
                new Date("2026-08-04T04:00:00.000Z"),
            ),
        ).rejects.toThrow("อยู่นอกช่วงที่ระบบรองรับ");
        expect(prismaMock.routineOccurrence.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("fails closed when a future occurrence has an original date outside the backward safety bound", async () => {
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(asNever({
            id: 999,
            dueDate: new Date("2026-08-10T00:00:00.000Z"),
            originalDueDate: new Date("2020-01-31T00:00:00.000Z"),
        }));

        await expect(
            generateRoutineTaskOccurrences(
                71,
                new Date("2026-08-05T04:00:00.000Z"),
            ),
        ).rejects.toThrow("อยู่นอกช่วงที่ระบบรองรับ");
        expect(prismaMock.routineOccurrence.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    OR: expect.arrayContaining([
                        {
                            originalDueDate: {
                                lt: new Date("2025-06-21T00:00:00.000Z"),
                            },
                        },
                    ]),
                }),
            }),
        );
        expect(prismaMock.routineOccurrence.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("fails closed when stored reminder data exceeds the supported horizon", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({ reminderRules: [{ daysBefore: 366 }] })),
        );

        await expect(
            generateRoutineTaskOccurrences(
                71,
                new Date("2026-08-04T04:00:00.000Z"),
            ),
        ).rejects.toThrow("อยู่นอกช่วงที่ระบบรองรับ");
        expect(prismaMock.routineOccurrence.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrence.upsert).not.toHaveBeenCalled();
    });

    it("removes future occurrences outside a reduced contract end date", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                contractEndDate: new Date("2026-08-31T00:00:00.000Z"),
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({ periodKey: "2026-08" }),
            generatedOccurrence({
                id: 101,
                periodKey: "2026-09",
                dueDate: new Date("2026-09-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-09-10T00:00:00.000Z"),
            }),
            generatedOccurrence({
                id: 102,
                periodKey: "2026-10",
                dueDate: new Date("2026-10-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-10-10T00:00:00.000Z"),
            }),
            generatedOccurrence({
                id: 103,
                periodKey: "2027-08",
                dueDate: new Date("2027-08-10T00:00:00.000Z"),
                originalDueDate: new Date("2027-08-10T00:00:00.000Z"),
            }),
        ]));

        const result = await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(result).toEqual({ evaluated: 1, created: 0, existing: 1 });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith(
            {
                where: expect.objectContaining({
                    dueDate: {
                        gte: new Date("2026-08-04T00:00:00.000Z"),
                        lte: new Date("2027-08-10T00:00:00.000Z"),
                    },
                    periodKey: { notIn: ["2026-08"] },
                }),
            },
        );
    });

    it("refreshes a weekend-adjusted due date when the business-day policy changes", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MONTH_END",
                scheduleConfig: {},
                businessDayPolicy: "NONE",
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                periodKey: "2026-10",
                originalDueDate: new Date("2026-10-31T00:00:00.000Z"),
                dueDate: new Date("2026-11-02T00:00:00.000Z"),
                isDueDateOverridden: false,
                scheduleVersion: 4,
            }),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-10-01T04:00:00.000Z"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 100, scheduleVersion: 4 },
            data: {
                scheduleVersion: 5,
                dueDate: new Date("2026-10-31T00:00:00.000Z"),
                reminderVersion: { increment: 1 },
            },
        });
    });

    it("refreshes a weekend-adjusted due date when the schedule date changes", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleType: "MONTHLY_DAY",
                scheduleConfig: { day: 30, monthOffset: 0 },
                businessDayPolicy: "NONE",
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                periodKey: "2026-10",
                originalDueDate: new Date("2026-10-31T00:00:00.000Z"),
                dueDate: new Date("2026-11-02T00:00:00.000Z"),
                isDueDateOverridden: false,
                scheduleVersion: 4,
            }),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-10-01T04:00:00.000Z"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 100, scheduleVersion: 4 },
            data: {
                scheduleVersion: 5,
                originalDueDate: new Date("2026-10-30T00:00:00.000Z"),
                dueDate: new Date("2026-10-30T00:00:00.000Z"),
                reminderVersion: { increment: 1 },
            },
        });
    });

    it("updates the new original date while preserving a future admin due-date override", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                scheduleConfig: { day: 15, monthOffset: 0 },
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                dueDate: new Date("2026-08-20T00:00:00.000Z"),
                originalDueDate: new Date("2026-08-10T00:00:00.000Z"),
                isDueDateOverridden: true,
            }),
            generatedOccurrence({
                id: 101,
                periodKey: "2026-09",
                dueDate: new Date("2026-09-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-09-10T00:00:00.000Z"),
            }),
            generatedOccurrence({
                id: 102,
                periodKey: "2026-10",
                dueDate: new Date("2026-10-10T00:00:00.000Z"),
                originalDueDate: new Date("2026-10-10T00:00:00.000Z"),
            }),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 100, scheduleVersion: 3 },
            data: {
                scheduleVersion: 5,
                originalDueDate: new Date("2026-08-15T00:00:00.000Z"),
                reminderVersion: { increment: 1 },
            },
        });
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    dueDate: new Date("2026-08-15T00:00:00.000Z"),
                }),
            }),
        );
    });

    it("does not include past occurrences in the stale-delete scope", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({ version: 5 })),
        );

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
        );

        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    dueDate: expect.objectContaining({
                        gte: new Date("2026-08-04T00:00:00.000Z"),
                    }),
                }),
            }),
        );
    });

    it("syncs future template assignees only when the snapshot was not manually changed", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                assignees: [{ employeeId: 21, role: "OWNER" }],
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence(),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
            {
                previousAssignees: [
                    { employeeId: 11, role: "OWNER" },
                    { employeeId: 12, role: "CO_OWNER" },
                ],
            },
        );

        expect(prismaMock.routineOccurrenceAssignee.deleteMany).toHaveBeenCalledWith({
            where: { occurrenceId: 100 },
        });
        expect(prismaMock.routineOccurrenceAssignee.createMany).toHaveBeenCalledWith({
            data: [{ occurrenceId: 100, employeeId: 21, role: "OWNER" }],
        });
    });

    it("adds a new task co-owner to future occurrences that still match the old snapshot", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                assignees: [
                    { employeeId: 11, role: "OWNER" },
                    { employeeId: 12, role: "CO_OWNER" },
                ],
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                assignees: [{ employeeId: 11, role: "OWNER" }],
            }),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
            {
                previousAssignees: [{ employeeId: 11, role: "OWNER" }],
            },
        );

        expect(prismaMock.routineOccurrenceAssignee.deleteMany).toHaveBeenCalledWith({
            where: { occurrenceId: 100 },
        });
        expect(prismaMock.routineOccurrenceAssignee.createMany).toHaveBeenCalledWith({
            data: [
                { occurrenceId: 100, employeeId: 11, role: "OWNER" },
                { occurrenceId: 100, employeeId: 12, role: "CO_OWNER" },
            ],
        });
    });

    it("preserves a future occurrence snapshot that differs from the old template", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(activeTask({
                assignees: [{ employeeId: 21, role: "OWNER" }],
                version: 5,
            })),
        );
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            generatedOccurrence({
                assignees: [{ employeeId: 99, role: "OWNER" }],
            }),
        ]));

        await generateRoutineTaskOccurrences(
            71,
            new Date("2026-08-04T04:00:00.000Z"),
            {
                previousAssignees: [
                    { employeeId: 11, role: "OWNER" },
                    { employeeId: 12, role: "CO_OWNER" },
                ],
            },
        );

        expect(prismaMock.routineOccurrenceAssignee.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrenceAssignee.createMany).not.toHaveBeenCalled();
    });
});
