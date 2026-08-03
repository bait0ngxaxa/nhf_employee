import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    changeRoutineOccurrenceStatus,
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
    const task = {
        id: 71,
        title: "ตรวจสอบระบบประจำเดือน",
        description: null,
        scheduleType: "MONTHLY_DAY",
        scheduleText: null,
        unit: { id: 1, code: "มสช.", name: "มสช." },
        category: { id: 1, name: "ระบบคอมพิวเตอร์" },
    };
    const assignee = {
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
    };
    return {
        id: 91,
        taskId: 71,
        periodKey: "2026-01",
        dueDate: new Date("2026-01-10T00:00:00.000Z"),
        originalDueDate: new Date("2026-01-10T00:00:00.000Z"),
        status: "TODO",
        scheduleVersion: 1,
        startedAt: null,
        completedAt: null,
        completedById: null,
        completionNote: null,
        referenceNo: null,
        skippedAt: null,
        skippedById: null,
        skipReason: null,
        cancelledAt: null,
        cancelledById: null,
        cancellationReason: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        task,
        assignees: [assignee],
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
    });

    it("lets only the snapshot assignee complete an occurrence and audits it", async () => {
        const initial = occurrence();
        const completed = occurrence({
            status: "COMPLETED",
            completedById: 3,
            completionNote: "ดำเนินการเรียบร้อย",
            referenceNo: "REF-1",
        });
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 20)),
        );
        prismaMock.routineOccurrence.findUnique
            .mockResolvedValueOnce(asNever(initial))
            .mockResolvedValueOnce(asNever(completed));

        const result = await changeRoutineOccurrenceStatus(
            91,
            {
                status: "COMPLETED",
                completionNote: "ดำเนินการเรียบร้อย",
                referenceNo: "REF-1",
            },
            actor(3),
        );

        expect(result.status).toBe("COMPLETED");
        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: { id: 91, status: "TODO" },
            data: expect.objectContaining({
                status: "COMPLETED",
                completedById: 3,
                completedAt: expect.any(Date),
            }),
        });
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "ROUTINE_OCCURRENCE_COMPLETE",
                entityType: "RoutineOccurrence",
                entityId: 91,
            }),
        });
    });

    it("does not allow a user to update another employee's occurrence", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 20)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence({
                assignees: [{
                    employeeId: 21,
                    role: "OWNER",
                    employee: {
                        id: 21,
                        firstName: "คนอื่น",
                        lastName: "ในทีม",
                        nickname: null,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                }],
            })),
        );

        await expect(
            changeRoutineOccurrenceStatus(
                91,
                { status: "IN_PROGRESS" },
                actor(3),
            ),
        ).rejects.toThrow("ไม่พบงานประจำ");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects an inactive employee even when the employee was an assignee", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 20, "INACTIVE")),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence()),
        );

        await expect(
            changeRoutineOccurrenceStatus(
                91,
                { status: "IN_PROGRESS" },
                actor(3),
            ),
        ).rejects.toThrow("บัญชีพนักงานไม่พร้อมดำเนินการ");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a duplicate completion after a terminal status", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("USER", 20)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence({ status: "COMPLETED" })),
        );

        await expect(
            changeRoutineOccurrenceStatus(
                91,
                { status: "COMPLETED" },
                actor(3),
            ),
        ).rejects.toThrow("งานนี้ปิดงานไปแล้ว");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it("requires a reason when an admin changes a due date", async () => {
        prismaMock.user.findUnique.mockResolvedValue(
            asNever(activeUser("ADMIN", 99)),
        );
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(occurrence()),
        );

        await expect(
            updateRoutineOccurrenceDueDate(
                91,
                { dueDate: "2026-02-10", reason: "สั้น" },
                actor(99, "ADMIN"),
            ),
        ).rejects.toThrow("อย่างน้อย 5 ตัวอักษร");
        expect(prismaMock.routineOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it("increments the reminder version when an admin changes a due date", async () => {
        const initial = occurrence();
        const updated = occurrence({
            dueDate: new Date("2026-02-10T00:00:00.000Z"),
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
            { dueDate: "2026-02-10", reason: "ปรับตามกำหนดใหม่" },
            actor(99, "ADMIN"),
        );

        expect(prismaMock.routineOccurrence.updateMany).toHaveBeenCalledWith({
            where: {
                id: 91,
                dueDate: new Date("2026-01-10T00:00:00.000Z"),
            },
            data: expect.objectContaining({
                dueDate: new Date("2026-02-10T00:00:00.000Z"),
                reminderVersion: { increment: 1 },
            }),
        });
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
});
