import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    createRoutineTaskInTransaction,
    reassignRoutineOccurrence,
    updateRoutineOccurrenceOverride,
    updateRoutineOccurrenceDueDate,
    updateRoutineTask,
} from "@/lib/services/routine/mutations";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: vi.fn(async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prisma as unknown as Prisma.TransactionClient)),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const generateRoutineTaskOccurrencesInTransactionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/routine/generation", () => ({
    generateRoutineTaskOccurrencesInTransaction: generateRoutineTaskOccurrencesInTransactionMock,
}));

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function actor(id: number, role: "USER" | "ADMIN" = "USER") {
    return {
        id,
        email: `${role.toLowerCase()}-${id}@example.com`,
        name: role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน",
        role,
        ipAddress: "192.0.2.10",
        userAgent: "routine-test",
        requestId: "routine-request",
        correlationId: "routine-correlation",
    } as const;
}

function occurrence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 91,
        taskId: 71,
        periodKey: "2026-01",
        dueDate: new Date("2026-01-10T00:00:00.000Z"),
        originalDueDate: new Date("2026-01-10T00:00:00.000Z"),
        isDueDateOverridden: false,
        scheduleVersion: 1,
        reminderVersion: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        task: {
            id: 71,
            title: "ตรวจสอบระบบประจำเดือน",
            description: null,
            scheduleType: "MONTHLY_DAY",
            scheduleText: null,
            isActive: true,
            unit: { id: 1, code: "มสช.", name: "มสช." },
            category: { id: 1, name: "ระบบคอมพิวเตอร์" },
        },
        assignees: [{
            employeeId: 20,
            role: "OWNER",
            employee: {
                id: 20,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                status: "ACTIVE",
                deletedAt: null,
            },
        }],
        ...overrides,
    };
}

function activeUser(role: "USER" | "ADMIN", employeeId: number, status = "ACTIVE") {
    return {
        id: role === "ADMIN" ? 99 : 3,
        role,
        isActive: true,
        deletedAt: null,
        employee: { id: employeeId, status, deletedAt: null },
    };
}

describe("NHF Routine mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$queryRaw.mockResolvedValue(asNever([]));
        prismaMock.auditLog.create.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineOccurrence.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        generateRoutineTaskOccurrencesInTransactionMock.mockResolvedValue({
            evaluated: 1,
            created: 1,
            existing: 0,
        });
    });

    it("lets an admin change a due date without a required reason", async () => {
        const initial = occurrence();
        const updated = occurrence({
            dueDate: new Date("2026-02-10T00:00:00.000Z"),
            isDueDateOverridden: true,
            reminderVersion: 2,
        });
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique
            .mockResolvedValueOnce(asNever(initial))
            .mockResolvedValueOnce(asNever(updated));

        await updateRoutineOccurrenceDueDate(
            91,
            { expectedReminderVersion: 1, dueDate: "2026-02-10" },
            actor(99, "ADMIN"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: {
                id: 91,
                dueDate: new Date("2026-01-10T00:00:00.000Z"),
                reminderVersion: 1,
            },
            data: expect.objectContaining({
                dueDate: new Date("2026-02-10T00:00:00.000Z"),
                isDueDateOverridden: true,
                reminderVersion: { increment: 1 },
            }),
        });
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE",
                details: expect.stringContaining('"oldDueDate":"2026-01-10"'),
            }),
        });
    });

    it("updates an occurrence due date and assignees atomically with one version bump", async () => {
        const initial = occurrence();
        const updated = occurrence({
            dueDate: new Date("2026-02-10T00:00:00.000Z"),
            isDueDateOverridden: true,
            reminderVersion: 2,
            assignees: [{
                employeeId: 21,
                role: "OWNER",
                employee: {
                    id: 21,
                    firstName: "มานะ",
                    lastName: "ดีใจ",
                    nickname: null,
                    status: "ACTIVE",
                    deletedAt: null,
                },
            }],
        });
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 21 }]));
        prismaMock.routineOccurrence.findUnique
            .mockResolvedValueOnce(asNever(initial))
            .mockResolvedValueOnce(asNever(updated));

        await updateRoutineOccurrenceOverride(
            91,
            {
                expectedReminderVersion: 1,
                dueDate: "2026-02-10",
                note: "ปรับรอบเฉพาะกิจ",
                assignees: [{ employeeId: 21, role: "OWNER" }],
            },
            actor(99, "ADMIN"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 91, reminderVersion: 1 },
            data: {
                dueDate: new Date("2026-02-10T00:00:00.000Z"),
                isDueDateOverridden: true,
                reminderVersion: { increment: 1 },
            },
        });
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).toHaveBeenCalledWith({
            where: { occurrenceId: 91 },
        });
        expect(prismaMock.routineOccurrenceAssignee.createMany).toHaveBeenCalledWith({
            data: [{ occurrenceId: 91, employeeId: 21, role: "OWNER" }],
        });
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE",
                details: expect.stringContaining('"reminderVersion":2'),
            }),
        });
    });

    it("rejects a stale occurrence override before changing any data", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence({ reminderVersion: 2 })),
        );

        await expect(
            updateRoutineOccurrenceOverride(
                91,
                {
                    expectedReminderVersion: 1,
                    dueDate: "2026-01-10",
                    assignees: [{ employeeId: 20, role: "OWNER" }],
                },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("checks the expected version for an atomic no-op without incrementing it", async () => {
        const initial = occurrence();
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 20 }]));
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(initial),
        );

        await updateRoutineOccurrenceOverride(
            91,
            {
                expectedReminderVersion: 1,
                dueDate: "2026-01-10",
                assignees: [{ employeeId: 20, role: "OWNER" }],
            },
            actor(99, "ADMIN"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 91, reminderVersion: 1 },
            data: { reminderVersion: { increment: 0 } },
        });
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("returns a conflict when the atomic version claim loses a race", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 21 }]));
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence()),
        );
        prismaMock.routineOccurrence.updateMany.mockResolvedValueOnce(
            asNever({ count: 0 }),
        );

        await expect(
            updateRoutineOccurrenceOverride(
                91,
                {
                    expectedReminderVersion: 1,
                    dueDate: "2026-02-10",
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว");
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("rolls back an atomic override when an assignee is inactive", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence()),
        );
        prismaMock.employee.findMany.mockResolvedValue(asNever([]));

        await expect(
            updateRoutineOccurrenceOverride(
                91,
                {
                    expectedReminderVersion: 1,
                    dueDate: "2026-02-10",
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ผู้รับผิดชอบต้องเป็นพนักงานที่ยังปฏิบัติงาน");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("snapshots new active assignees and increments the reminder version", async () => {
        const initial = occurrence();
        const updated = occurrence({
            reminderVersion: 2,
            assignees: [{
                employeeId: 21,
                role: "OWNER",
                employee: {
                    id: 21,
                    firstName: "มานะ",
                    lastName: "ดีใจ",
                    nickname: null,
                    status: "ACTIVE",
                    deletedAt: null,
                },
            }],
        });
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique
            .mockResolvedValueOnce(asNever(initial))
            .mockResolvedValueOnce(asNever(updated));
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 21 }]));

        await reassignRoutineOccurrence(
            91,
            {
                expectedReminderVersion: 1,
                assignees: [{ employeeId: 21, role: "OWNER" }],
            },
            actor(99, "ADMIN"),
        );

        expect(prismaMock.routineOccurrenceAssignee.deleteMany).toHaveBeenCalledWith({
            where: { occurrenceId: 91 },
        });
        expect(prismaMock.routineOccurrenceAssignee.createMany).toHaveBeenCalledWith({
            data: [{ occurrenceId: 91, employeeId: 21, role: "OWNER" }],
        });
        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 91, reminderVersion: 1 },
            data: { reminderVersion: { increment: 1 } },
        });
    });

    it("rejects a stale legacy due-date request before changing any data", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence({ reminderVersion: 2 })),
        );

        await expect(
            updateRoutineOccurrenceDueDate(
                91,
                { expectedReminderVersion: 1, dueDate: "2026-02-10" },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects a stale legacy assignee request before changing any data", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence({ reminderVersion: 2 })),
        );
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 21 }]));

        await expect(
            reassignRoutineOccurrence(
                91,
                {
                    expectedReminderVersion: 1,
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว");
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects reassignment to an inactive employee", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence()),
        );
        prismaMock.employee.findMany.mockResolvedValue(asNever([]));

        await expect(
            reassignRoutineOccurrence(
                91,
                {
                    expectedReminderVersion: 1,
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ผู้รับผิดชอบต้องเป็นพนักงานที่ยังปฏิบัติงาน");
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).not.toHaveBeenCalled();
    });

    it("returns a conflict for a stale task version", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineUnit.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever({
                id: 71,
                unitId: 1,
                categoryId: 1,
                title: "งานเดิม",
                description: null,
                scheduleType: "MONTHLY_DAY",
                scheduleConfig: { day: 10, monthOffset: 0 },
                scheduleText: null,
                contractStartDate: null,
                contractEndDate: null,
                contractText: null,
                extraDetails: null,
                businessDayPolicy: "NONE",
                isActive: true,
                version: 2,
                sourceFileName: null,
                sourceSheet: null,
                sourceRow: null,
                createdById: 99,
                updatedById: 99,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                unit: { id: 1, code: "มสช.", name: "มสช.", isActive: true },
                category: { id: 1, name: "อื่น ๆ", sortOrder: 1, isActive: true },
                assignees: [],
            }),
        );
        prismaMock.routineTask.updateMany.mockResolvedValue(
            asNever({ count: 0 }),
        );

        await expect(
            updateRoutineTask(
                71,
                { version: 1, title: "แก้ไขทับข้อมูลเดิม" },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("ข้อมูลแม่แบบงานเปลี่ยนแปลงแล้ว");
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("reconciles the expanded reminder horizon during a Task update", async () => {
        const current = {
            id: 71,
            unitId: 1,
            categoryId: 1,
            title: "งานเดิม",
            description: null,
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2027-08-04" },
            scheduleText: null,
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            businessDayPolicy: "NONE",
            isActive: true,
            version: 1,
            sourceFileName: null,
            sourceSheet: null,
            sourceRow: null,
            createdById: 99,
            updatedById: 99,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            unit: { id: 1, code: "มสช.", name: "มสช.", isActive: true },
            category: { id: 1, name: "อื่น ๆ", sortOrder: 1, isActive: true },
            assignees: [{ employeeId: 11, role: "OWNER" }],
            reminderRules: [{
                id: 31,
                daysBefore: 7,
                sendHour: 9,
                channel: "IN_APP",
                recipientScope: "ASSIGNEES",
                isActive: true,
            }],
        };
        const updated = { ...current, version: 2 };
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineUnit.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 11 }]));
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(current));
        prismaMock.routineTask.updateMany.mockResolvedValue(asNever({ count: 1 }));
        prismaMock.routineTask.findUniqueOrThrow.mockResolvedValue(asNever(updated));

        await updateRoutineTask(
            71,
            {
                version: 1,
                reminderRules: [{
                    daysBefore: 365,
                    sendHour: 9,
                    channel: "IN_APP",
                    recipientScope: "ASSIGNEES",
                    isActive: true,
                }],
            },
            actor(99, "ADMIN"),
        );

        expect(prismaMock.routineReminderRule.deleteMany).toHaveBeenCalledWith({ where: { taskId: 71 } });
        expect(prismaMock.routineReminderRule.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [expect.objectContaining({ taskId: 71, daysBefore: 365 })],
            }),
        );
        expect(generateRoutineTaskOccurrencesInTransactionMock).toHaveBeenCalledWith(
            prismaMock,
            71,
            undefined,
            { previousAssignees: undefined },
        );
    });

    it("canonicalizes a self-service task to the authenticated employee", async () => {
        const createdTask = {
            id: 72,
            version: 1,
            unitId: 1,
            categoryId: 1,
            title: "งานของฉัน",
        };
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 11)),
        );
        prismaMock.routineUnit.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 11 }]));
        prismaMock.routineTask.create.mockResolvedValue(asNever(createdTask));
        prismaMock.routineTask.findUniqueOrThrow.mockResolvedValue(asNever(createdTask));

        await createRoutineTaskInTransaction(
            prismaMock as unknown as Prisma.TransactionClient,
            {
                unitId: 1,
                categoryId: 1,
                title: "งานของฉัน",
                scheduleType: "MONTHLY_DAY",
                scheduleConfig: { day: 10, monthOffset: 0 },
                businessDayPolicy: "NONE",
                isActive: true,
                assignees: [{ employeeId: 999, role: "OWNER" }],
                sourceFileName: "spoof.xlsx",
                sourceSheet: "Sheet1",
                sourceRow: 12,
                reminderRules: [{
                    daysBefore: 1,
                    sendHour: 9,
                    channel: "IN_APP",
                    recipientScope: "ADMINS",
                    isActive: true,
                }],
            },
            actor(3, "USER"),
        );

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

    it("rejects self-service creation when the employee is inactive", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 11, "INACTIVE")),
        );

        await expect(
            createRoutineTaskInTransaction(
                prismaMock as unknown as Prisma.TransactionClient,
                {
                    unitId: 1,
                    categoryId: 1,
                    title: "งานของฉัน",
                    scheduleType: "MONTHLY_DAY",
                    scheduleConfig: { day: 10, monthOffset: 0 },
                    businessDayPolicy: "NONE",
                    isActive: true,
                    assignees: [{ employeeId: 999, role: "OWNER" }],
                },
                actor(3, "USER"),
            ),
        ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
        expect(prismaMock.routineTask.create).not.toHaveBeenCalled();
    });

    it("does not let self-service updates change assignees or import metadata", async () => {
        const current = {
            id: 71,
            unitId: 1,
            categoryId: 1,
            title: "งานเดิม",
            description: null,
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2027-08-04" },
            scheduleText: null,
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            businessDayPolicy: "NONE",
            isActive: true,
            version: 1,
            sourceFileName: null,
            sourceSheet: null,
            sourceRow: null,
            createdById: 3,
            updatedById: 3,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            unit: { id: 1, code: "มสช.", name: "มสช.", isActive: true },
            category: { id: 1, name: "อื่น ๆ", sortOrder: 1, isActive: true },
            assignees: [{ employeeId: 11, role: "OWNER" }],
            reminderRules: [{
                id: 31,
                daysBefore: 7,
                sendHour: 9,
                channel: "IN_APP",
                recipientScope: "ASSIGNEES",
                isActive: true,
            }],
        };
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 11)),
        );
        prismaMock.routineUnit.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineTask.findFirst.mockResolvedValue(asNever(current));
        prismaMock.routineTask.updateMany.mockResolvedValue(asNever({ count: 1 }));
        prismaMock.routineTask.findUniqueOrThrow.mockResolvedValue(
            asNever({ ...current, version: 2, title: "แก้ไขแล้ว" }),
        );

        await updateRoutineTask(
            71,
            {
                version: 1,
                title: "แก้ไขแล้ว",
                assignees: [{ employeeId: 999, role: "OWNER" }],
                sourceFileName: "spoof.xlsx",
                sourceSheet: "Sheet1",
                sourceRow: 1,
                reminderRules: [{
                    daysBefore: 3,
                    sendHour: 10,
                    channel: "IN_APP",
                    recipientScope: "ADMINS",
                    isActive: true,
                }],
            },
            actor(3, "USER"),
        );

        expect(prismaMock.routineTask.updateMany).toHaveBeenCalledWith({
            where: { id: 71, version: 1, createdById: 3 },
            data: expect.objectContaining({
                title: "แก้ไขแล้ว",
                updatedById: 3,
            }),
        });
        expect(prismaMock.routineTaskAssignee.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.routineReminderRule.createMany).toHaveBeenCalledWith({
            data: [{
                taskId: 71,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                daysBefore: 3,
                sendHour: 10,
                channel: "IN_APP",
                recipientScope: "ASSIGNEES",
                isActive: true,
            }],
        });
    });

    it("returns not found when a self-service user updates another user's task", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 11)),
        );
        prismaMock.routineTask.findFirst.mockResolvedValue(null);

        await expect(
            updateRoutineTask(
                71,
                { version: 1, title: "ไม่ควรแก้ได้" },
                actor(3, "USER"),
            ),
        ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
        expect(prismaMock.routineTask.updateMany).not.toHaveBeenCalled();
    });
});
