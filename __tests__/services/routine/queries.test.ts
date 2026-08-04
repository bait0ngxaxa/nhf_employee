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
} from "@/lib/services/routine/queries";

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
                    assignees: { some: { employeeId: 21 } },
                },
            }),
        );
        expect(prismaMock.routineOccurrence.count).toHaveBeenCalledWith({
            where: {
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
            expect.objectContaining({ where: {} }),
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
});
