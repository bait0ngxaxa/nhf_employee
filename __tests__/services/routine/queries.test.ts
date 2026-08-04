import { beforeEach, describe, expect, it, vi } from "vitest";
import { type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    addCalendarDays,
    calendarDateToDate,
    getCurrentBangkokDate,
} from "@/lib/routine/schedule";
import {
    getRoutineOccurrenceById,
    getRoutineOccurrences,
    getRoutineSummary,
    getRoutineTaskWorkItems,
    getRoutineTasks,
} from "@/lib/services/routine/queries";
import { routineTaskFiltersSchema } from "@/lib/validations/routine";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("NHF Routine query authorization", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.routineOccurrence.findMany.mockResolvedValue([] as never);
        prismaMock.routineOccurrence.count.mockResolvedValue(0);
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(null);
        prismaMock.routineTask.findMany.mockResolvedValue([] as never);
        prismaMock.routineTask.count.mockResolvedValue(0);
    });

    it("forces a regular user query to their occurrence snapshot", async () => {
        await getRoutineOccurrences(
            {
                timingStatus: undefined,
                unitId: undefined,
                categoryId: undefined,
                assigneeId: 999,
                dueFrom: undefined,
                dueTo: undefined,
                search: undefined,
                scope: "all",
                page: 1,
                limit: 20,
            },
            {
                actor: {
                    id: 5,
                    email: "user@example.com",
                    role: "USER",
                    ipAddress: "192.0.2.5",
                    userAgent: "routine-test",
                    requestId: "request-5",
                    correlationId: "correlation-5",
                },
                employeeId: 21,
            },
        );

        expect(prismaMock.routineOccurrence.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    task: { isActive: true },
                    assignees: { some: { employeeId: 21 } },
                },
            }),
        );
        expect(prismaMock.routineOccurrence.count).toHaveBeenCalledWith({
            where: {
                task: { isActive: true },
                assignees: { some: { employeeId: 21 } },
            },
        });
    });

    it("does not add an assignee scope to an admin all-occurrences query", async () => {
        await getRoutineOccurrences(
            {
                timingStatus: undefined,
                unitId: undefined,
                categoryId: undefined,
                assigneeId: undefined,
                dueFrom: undefined,
                dueTo: undefined,
                search: undefined,
                scope: "all",
                page: 1,
                limit: 20,
            },
            {
                actor: {
                    id: 99,
                    email: "admin@example.com",
                    role: "ADMIN",
                    ipAddress: "192.0.2.99",
                    userAgent: "routine-test",
                    requestId: "request-99",
                    correlationId: "correlation-99",
                },
                employeeId: null,
            },
        );

        expect(prismaMock.routineOccurrence.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { task: { isActive: true } } }),
        );
    });

    it("hides a detail record when the user is not its snapshot assignee", async () => {
        const result = await getRoutineOccurrenceById(91, {
            actor: {
                id: 5,
                email: "user@example.com",
                role: "USER",
                ipAddress: "192.0.2.5",
                userAgent: "routine-test",
                requestId: "request-5",
                correlationId: "correlation-5",
            },
            employeeId: 21,
        });

        expect(result).toBeNull();
        expect(prismaMock.routineOccurrence.findFirst).toHaveBeenCalledWith({
            where: {
                id: 91,
                task: { isActive: true },
                assignees: { some: { employeeId: 21 } },
            },
            select: expect.any(Object),
        });
    });

    it("translates a timing filter into a database due-date range", async () => {
        const today = getCurrentBangkokDate();
        await getRoutineOccurrences(
            {
                timingStatus: "DUE_SOON",
                unitId: undefined,
                categoryId: undefined,
                assigneeId: undefined,
                dueFrom: undefined,
                dueTo: undefined,
                search: undefined,
                scope: "all",
                page: 1,
                limit: 20,
            },
            {
                actor: {
                    id: 99,
                    email: "admin@example.com",
                    role: "ADMIN",
                    ipAddress: "192.0.2.99",
                    userAgent: "routine-test",
                    requestId: "request-99",
                    correlationId: "correlation-99",
                },
                employeeId: null,
            },
        );

        expect(prismaMock.routineOccurrence.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    dueDate: {
                        gt: calendarDateToDate(today),
                        lte: calendarDateToDate(addCalendarDays(today, 7)),
                    },
                    task: { isActive: true },
                },
            }),
        );
    });

    it("serializes timing fields without workflow fields", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            {
                id: 91,
                taskId: 71,
                periodKey: "2026-08",
                dueDate: calendarDateToDate(today),
                originalDueDate: calendarDateToDate(today),
                scheduleVersion: 1,
                reminderVersion: 1,
                createdAt: new Date("2026-08-01T00:00:00.000Z"),
                updatedAt: new Date("2026-08-01T00:00:00.000Z"),
                task: {
                    id: 71,
                    title: "ตรวจสอบระบบ",
                    description: null,
                    scheduleType: "MONTHLY_DAY",
                    scheduleText: null,
                    unit: { id: 1, code: "มสช.", name: "มสช." },
                    category: { id: 1, name: "ระบบคอมพิวเตอร์" },
                },
                assignees: [{
                    employeeId: 21,
                    role: "OWNER",
                    employee: {
                        id: 21,
                        firstName: "สมชาย",
                        lastName: "ใจดี",
                        nickname: null,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                }],
            },
        ]));
        prismaMock.routineOccurrence.count.mockResolvedValue(1);

        const result = await getRoutineOccurrences(
            {
                timingStatus: "DUE_TODAY",
                scope: "all",
                page: 1,
                limit: 20,
            },
            {
                actor: {
                    id: 99,
                    email: "admin@example.com",
                    role: "ADMIN",
                    ipAddress: "192.0.2.99",
                    userAgent: "routine-test",
                    requestId: "request-99",
                    correlationId: "correlation-99",
                },
                employeeId: null,
            },
        );

        expect(result.occurrences[0]).toMatchObject({
            timingStatus: "DUE_TODAY",
            daysUntilDue: 0,
            isOverdue: false,
        });
        expect(result.occurrences[0]).not.toHaveProperty("status");
        expect(result.occurrences[0]).not.toHaveProperty("completedAt");
    });

    it("only counts active-task occurrences in the summary", async () => {
        await getRoutineSummary({
            actor: {
                id: 99,
                email: "admin@example.com",
                role: "ADMIN",
            },
            employeeId: null,
        });

        expect(prismaMock.routineTask.count).toHaveBeenCalledTimes(4);
        for (const [call] of prismaMock.routineTask.count.mock.calls) {
            expect(call).toEqual({
                where: expect.objectContaining({
                    isActive: true,
                    occurrences: expect.objectContaining({ some: expect.any(Object) }),
                }),
            });
        }
    });

    it("returns one operational row per active task", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            {
                id: 71,
                occurrences: [{
                    id: 91,
                    taskId: 71,
                    periodKey: "2026-08",
                    dueDate: calendarDateToDate(today),
                    originalDueDate: calendarDateToDate(today),
                    scheduleVersion: 1,
                    reminderVersion: 1,
                    createdAt: new Date("2026-08-01T00:00:00.000Z"),
                    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
                    task: {
                        id: 71,
                        title: "ตรวจสอบระบบ",
                        description: null,
                        scheduleType: "MONTHLY_DAY",
                        scheduleText: null,
                        unit: { id: 1, code: "มสช.", name: "มสช." },
                        category: { id: 1, name: "ระบบคอมพิวเตอร์" },
                    },
                    assignees: [],
                }],
            },
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);

        const result = await getRoutineTaskWorkItems(
            {
                scope: "all",
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 99, email: "admin@example.com", role: "ADMIN" },
                employeeId: null,
            },
        );

        expect(result.occurrences).toHaveLength(1);
        expect(result.pagination.total).toBe(1);
        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                    occurrences: { some: expect.any(Object) },
                }),
            }),
        );
    });

    it.each<[string, { activeOnly?: true }, { isActive?: true }]>([
        ["no filter", {}, {}],
        ["activeOnly=0", {}, {}],
        ["activeOnly=1", { activeOnly: true }, { isActive: true }],
    ])("builds the expected task filter for %s", async (_label, input, expected) => {
        await getRoutineTasks({
            ...input,
            activeOnly: input.activeOnly,
            page: 1,
            limit: 20,
        });

        expect(prismaMock.routineTask.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({ where: expected }),
        );
        expect(prismaMock.routineTask.count).toHaveBeenLastCalledWith({
            where: expected,
        });
    });

    it("parses task filter zero as no active predicate and one as active-only", () => {
        expect(routineTaskFiltersSchema.parse({}).activeOnly).toBeUndefined();
        expect(
            routineTaskFiltersSchema.parse({ activeOnly: "0" }).activeOnly,
        ).toBeUndefined();
        expect(
            routineTaskFiltersSchema.parse({ activeOnly: "1" }).activeOnly,
        ).toBe(true);
    });
});
