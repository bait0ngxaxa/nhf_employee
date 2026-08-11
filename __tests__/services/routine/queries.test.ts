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
    getRoutineReferenceData,
    getRoutineSummary,
    getRoutineTaskById,
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

function taskRow(id: number, employeeId = 21): Record<string, unknown> {
    return {
        id,
        title: `งาน ${id}`,
        description: null,
        scheduleType: "MONTHLY_DAY",
        scheduleText: "ทุกเดือน",
        isActive: true,
        unit: { id: 1, code: "มสช.", name: "มสช." },
        category: { id: 1, name: "ระบบคอมพิวเตอร์" },
        assignees: [{
            employeeId,
            role: "OWNER",
            employee: {
                id: employeeId,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                status: "ACTIVE",
                deletedAt: null,
            },
        }],
    };
}

function occurrenceRow(
    id: number,
    taskId: number,
    dueDate: string,
): Record<string, unknown> {
    return {
        id,
        taskId,
        periodKey: `${taskId}-${id}`,
        dueDate: calendarDateToDate(dueDate),
        originalDueDate: calendarDateToDate(dueDate),
        scheduleVersion: 1,
        reminderVersion: 1,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        task: {
            id: taskId,
            title: `งาน ${taskId}`,
            description: null,
            scheduleType: "MONTHLY_DAY",
            scheduleText: "ทุกเดือน",
            unit: { id: 1, code: "มสช.", name: "มสช." },
            category: { id: 1, name: "ระบบคอมพิวเตอร์" },
        },
        assignees: [],
    };
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

    it("resolves KPI counts from one relevant occurrence per active task", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            { id: 71 },
            { id: 72 },
            { id: 73 },
            { id: 74 },
        ]));
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            { id: 1, taskId: 71, dueDate: calendarDateToDate(addCalendarDays(today, -30)) },
            { id: 2, taskId: 71, dueDate: calendarDateToDate(addCalendarDays(today, 2)) },
            { id: 3, taskId: 72, dueDate: calendarDateToDate(today) },
            { id: 4, taskId: 72, dueDate: calendarDateToDate(addCalendarDays(today, 30)) },
            { id: 5, taskId: 73, dueDate: calendarDateToDate(addCalendarDays(today, 3)) },
            { id: 6, taskId: 73, dueDate: calendarDateToDate(addCalendarDays(today, 6)) },
        ]));

        const result = await getRoutineSummary({
            actor: {
                id: 99,
                email: "admin@example.com",
                role: "ADMIN",
            },
            employeeId: null,
        });

        expect(result).toMatchObject({
            today: 1,
            dueSoon: 2,
            within30Days: 3,
        });
        expect(result).not.toHaveProperty("overdue");
        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { isActive: true },
                select: { id: true },
            }),
        );
        expect(prismaMock.routineTask.count).not.toHaveBeenCalled();
    });

    it("uses the current Task assignee for a regular user's KPI scope", async () => {
        await getRoutineSummary({
            actor: {
                id: 5,
                email: "user@example.com",
                role: "USER",
            },
            employeeId: 21,
        });

        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    isActive: true,
                    assignees: { some: { employeeId: 21 } },
                },
                select: { id: true },
            }),
        );
    });

    it("returns one task row and the nearest relevant occurrence", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(1, 71, addCalendarDays(today, -180)),
            occurrenceRow(2, 71, addCalendarDays(today, 10)),
            occurrenceRow(3, 71, addCalendarDays(today, 3)),
        ]));

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

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.id).toBe(71);
        expect(result.tasks[0]?.relevantOccurrence?.id).toBe(3);
        expect(result.pagination.total).toBe(1);
        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                }),
            }),
        );
    });

    it("keeps a MANUAL task with no occurrence in the operational list", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([]));

        const result = await getRoutineTaskWorkItems(
            { scope: "all", page: 1, limit: 20 },
            { actor: { id: 99, email: "admin@example.com", role: "ADMIN" }, employeeId: null },
        );

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.relevantOccurrence).toBeNull();
    });

    it("returns two Task rows when each task has multiple occurrences", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71),
            taskRow(72),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(2);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(1, 71, addCalendarDays(today, 3)),
            occurrenceRow(2, 71, addCalendarDays(today, 10)),
            occurrenceRow(3, 72, addCalendarDays(today, 4)),
            occurrenceRow(4, 72, addCalendarDays(today, 11)),
        ]));

        const result = await getRoutineTaskWorkItems(
            { scope: "all", page: 1, limit: 20 },
            { actor: { id: 99, email: "admin@example.com", role: "ADMIN" }, employeeId: null },
        );

        expect(result.tasks.map((task) => task.id)).toEqual([71, 72]);
        expect(result.pagination.total).toBe(2);
        expect(result.tasks[0]?.relevantOccurrence?.id).toBe(1);
        expect(result.tasks[1]?.relevantOccurrence?.id).toBe(3);
    });

    it("uses a valid notification focus occurrence only within an authorized Task", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever({ taskId: 71, task: { isActive: true } }),
        );
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([taskRow(71)]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(1, 71, addCalendarDays(today, 3)),
            occurrenceRow(99, 71, addCalendarDays(today, 10)),
        ]));

        const result = await getRoutineTaskWorkItems(
            { scope: "all", taskId: 71, occurrenceId: 99, page: 1, limit: 20 },
            { actor: { id: 99, email: "admin@example.com", role: "ADMIN" }, employeeId: null },
        );

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.relevantOccurrence?.id).toBe(99);
        expect(prismaMock.routineOccurrence.findUnique).toHaveBeenCalledWith({
            where: { id: 99 },
            select: { taskId: true, task: { select: { isActive: true } } },
        });
    });

    it("denies an admin mine focus when the occurrence belongs to another employee", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 71,
            task: { isActive: true },
        }));
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(null);

        const result = await getRoutineTaskWorkItems(
            { scope: "mine", taskId: 71, occurrenceId: 99, page: 1, limit: 20 },
            { actor: { id: 99, email: "admin@example.com", role: "ADMIN" }, employeeId: 42 },
        );

        expect(result.tasks).toEqual([]);
        expect(prismaMock.routineTask.findMany).not.toHaveBeenCalled();
    });

    it("allows an admin mine focus for their own employee assignment", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 71,
            task: { isActive: true },
        }));
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(
            asNever({ taskId: 71 }),
        );
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71, 42),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(99, 71, addCalendarDays(today, 4)),
        ]));

        const result = await getRoutineTaskWorkItems(
            { scope: "mine", taskId: 71, occurrenceId: 99, page: 1, limit: 20 },
            { actor: { id: 99, email: "admin@example.com", role: "ADMIN" }, employeeId: 42 },
        );

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.id).toBe(71);
        expect(result.tasks[0]?.relevantOccurrence?.id).toBe(99);
    });

    it("keeps a regular user's mine focus employee-scoped", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 71,
            task: { isActive: true },
        }));
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(
            asNever({ taskId: 71 }),
        );
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71, 42),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(99, 71, addCalendarDays(today, 4)),
        ]));

        const result = await getRoutineTaskWorkItems(
            { scope: "mine", taskId: 71, occurrenceId: 99, page: 1, limit: 20 },
            { actor: { id: 5, email: "user@example.com", role: "USER" }, employeeId: 42 },
        );

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.id).toBe(71);
    });

    it("allows an active occurrence-only assignee to open the focused Task", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 71,
            task: { isActive: true },
        }));
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(
            asNever({ taskId: 71 }),
        );
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71, 21),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(99, 71, addCalendarDays(today, 4)),
        ]));

        const result = await getRoutineTaskWorkItems(
            {
                scope: "all",
                taskId: 71,
                occurrenceId: 99,
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 42,
            },
        );

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.id).toBe(71);
        expect(result.tasks[0]?.relevantOccurrence?.id).toBe(99);
        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: 71 }),
            }),
        );
    });

    it("denies focused access when the occurrence assignee is inactive", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 71,
            task: { isActive: true },
        }));
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(null);

        const result = await getRoutineTaskWorkItems(
            {
                scope: "all",
                taskId: 71,
                occurrenceId: 99,
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 42,
            },
        );

        expect(result.tasks).toEqual([]);
        expect(prismaMock.routineTask.findMany).not.toHaveBeenCalled();
    });

    it("does not grant occurrence-only access if the focused row disappears during fetch", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 71,
            task: { isActive: true },
        }));
        prismaMock.routineOccurrence.findFirst.mockResolvedValue(
            asNever({ taskId: 71 }),
        );
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71, 21),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue([] as never);
        prismaMock.routineTask.findFirst.mockResolvedValue(null);

        const result = await getRoutineTaskWorkItems(
            {
                scope: "all",
                taskId: 71,
                occurrenceId: 99,
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 42,
            },
        );

        expect(result).toEqual({
            tasks: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
    });

    it("fails closed when the focused occurrence belongs to another Task", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(asNever({
            taskId: 72,
            task: { isActive: true },
        }));

        const result = await getRoutineTaskWorkItems(
            {
                scope: "all",
                taskId: 71,
                occurrenceId: 99,
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 42,
            },
        );

        expect(result).toEqual({
            tasks: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
        expect(prismaMock.routineTask.findMany).not.toHaveBeenCalled();
    });

    it("falls back to a current Task assignee when the focused occurrence was deleted", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(null);
        prismaMock.routineTask.findFirst.mockResolvedValue(asNever({ id: 71 }));
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            taskRow(71, 42),
        ]));
        prismaMock.routineTask.count.mockResolvedValue(1);
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(100, 71, addCalendarDays(today, 2)),
        ]));

        const result = await getRoutineTaskWorkItems(
            {
                scope: "mine",
                taskId: 71,
                occurrenceId: 99,
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 42,
            },
        );

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.relevantOccurrence?.id).toBe(100);
    });

    it("does not fall back for an occurrence-only assignee after deletion", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(null);
        prismaMock.routineTask.findFirst.mockResolvedValue(null);

        const result = await getRoutineTaskWorkItems(
            {
                scope: "mine",
                taskId: 71,
                occurrenceId: 99,
                page: 1,
                limit: 20,
            },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 42,
            },
        );

        expect(result.tasks).toEqual([]);
        expect(prismaMock.routineTask.findMany).not.toHaveBeenCalled();
    });

    it("scopes regular users by current Task assignee even when scope=all is requested", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([taskRow(71)]));
        prismaMock.routineTask.count.mockResolvedValue(1);

        await getRoutineTaskWorkItems(
            { scope: "all", page: 1, limit: 20 },
            { actor: { id: 5, email: "user@example.com", role: "USER" }, employeeId: 21 },
        );

        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    isActive: true,
                    assignees: { some: { employeeId: 21 } },
                },
            }),
        );
    });

    it("counts and filters by Task rather than occurrence rows", async () => {
        const today = getCurrentBangkokDate();
        prismaMock.routineTask.findMany
            .mockResolvedValueOnce(asNever([{ id: 71 }, { id: 72 }]))
            .mockResolvedValueOnce(asNever([taskRow(72)]));
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            occurrenceRow(1, 71, addCalendarDays(today, -2)),
            occurrenceRow(2, 71, addCalendarDays(today, 10)),
            occurrenceRow(3, 72, addCalendarDays(today, 4)),
        ]));

        const result = await getRoutineTaskWorkItems(
            { scope: "all", timingStatus: "DUE_SOON", page: 1, limit: 20 },
            { actor: { id: 99, email: "admin@example.com", role: "ADMIN" }, employeeId: null },
        );

        expect(result.tasks.map((task) => task.id)).toEqual([72]);
        expect(result.pagination.total).toBe(1);
        expect(prismaMock.routineTask.count).not.toHaveBeenCalled();
    });

    it.each<[string, { activeOnly?: true; status?: "active" | "inactive" }, { isActive?: boolean }]>([
        ["no filter", {}, {}],
        ["activeOnly=0", {}, {}],
        ["activeOnly=1", { activeOnly: true }, { isActive: true }],
        ["status=active", { status: "active" }, { isActive: true }],
        ["status=inactive", { status: "inactive" }, { isActive: false }],
    ])("builds the expected task filter for %s", async (_label, input, expected) => {
        await getRoutineTasks({
            ...input,
            activeOnly: input.activeOnly,
            page: 1,
            limit: 20,
        }, {
            actor: { id: 99, email: "admin@example.com", role: "ADMIN" },
            employeeId: null,
        });

        expect(prismaMock.routineTask.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({ where: expected }),
        );
        expect(prismaMock.routineTask.count).toHaveBeenLastCalledWith({
            where: expected,
        });
    });

    it("scopes routine management queries to the creator for regular users", async () => {
        await getRoutineTasks(
            { activeOnly: undefined, page: 1, limit: 20 },
            {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 21,
            },
        );

        expect(prismaMock.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { createdById: 5 } }),
        );
        expect(prismaMock.routineTask.count).toHaveBeenCalledWith({
            where: { createdById: 5 },
        });
    });

    it("returns 404-compatible detail queries for another user's task", async () => {
        prismaMock.routineTask.findFirst.mockResolvedValue(null);

        await expect(
            getRoutineTaskById(71, {
                actor: { id: 5, email: "user@example.com", role: "USER" },
                employeeId: 21,
            }),
        ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });

        expect(prismaMock.routineTask.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 71, createdById: 5 },
            }),
        );
    });

    it("returns only the current employee in regular-user reference data", async () => {
        prismaMock.routineUnit.findMany.mockResolvedValue(asNever([]));
        prismaMock.routineCategory.findMany.mockResolvedValue(asNever([]));
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 21 }]));

        await getRoutineReferenceData({
            actor: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    status: "ACTIVE",
                    deletedAt: null,
                    user: {
                        is: {
                            id: 5,
                            isActive: true,
                            deletedAt: null,
                        },
                    },
                },
            }),
        );
    });

    it("derives notification readiness without returning linked User data", async () => {
        prismaMock.routineUnit.findMany.mockResolvedValue(asNever([]));
        prismaMock.routineCategory.findMany.mockResolvedValue(asNever([]));
        prismaMock.employee.findMany.mockResolvedValue(asNever([
            {
                id: 21,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                departmentId: 1,
                status: "ACTIVE",
                deletedAt: null,
                user: null,
            },
            {
                id: 22,
                firstName: "สมหญิง",
                lastName: "ใจดี",
                nickname: null,
                departmentId: 1,
                status: "ACTIVE",
                deletedAt: null,
                user: { isActive: false, deletedAt: null },
            },
            {
                id: 23,
                firstName: "มานะ",
                lastName: "พร้อม",
                nickname: null,
                departmentId: 1,
                status: "ACTIVE",
                deletedAt: null,
                user: { isActive: true, deletedAt: new Date("2026-08-01T00:00:00.000Z") },
            },
            {
                id: 24,
                firstName: "มานี",
                lastName: "พร้อม",
                nickname: null,
                departmentId: 1,
                status: "ACTIVE",
                deletedAt: null,
                user: { isActive: true, deletedAt: null },
            },
        ]));

        const reference = await getRoutineReferenceData({
            actor: { id: 99, email: "admin@example.com", role: "ADMIN" },
            employeeId: null,
        });

        expect(reference.employees).toEqual([
            {
                id: 21,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                departmentId: 1,
                notificationReady: false,
            },
            {
                id: 22,
                firstName: "สมหญิง",
                lastName: "ใจดี",
                nickname: null,
                departmentId: 1,
                notificationReady: false,
            },
            {
                id: 23,
                firstName: "มานะ",
                lastName: "พร้อม",
                nickname: null,
                departmentId: 1,
                notificationReady: false,
            },
            {
                id: 24,
                firstName: "มานี",
                lastName: "พร้อม",
                nickname: null,
                departmentId: 1,
                notificationReady: true,
            },
        ]);
        expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                select: expect.objectContaining({
                    user: {
                        select: { isActive: true, deletedAt: true },
                    },
                }),
            }),
        );
    });

    it("parses task filter zero as no active predicate and one as active-only", () => {
        expect(routineTaskFiltersSchema.parse({}).activeOnly).toBeUndefined();
        expect(
            routineTaskFiltersSchema.parse({ activeOnly: "0" }).activeOnly,
        ).toBeUndefined();
        expect(
            routineTaskFiltersSchema.parse({ activeOnly: "1" }).activeOnly,
        ).toBe(true);
        expect(
            routineTaskFiltersSchema.parse({ status: "inactive" }).status,
        ).toBe("inactive");
    });
});
