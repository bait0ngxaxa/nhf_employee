import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { deleteRoutineTask } from "@/lib/services/routine/mutations";

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

const adminActor = {
    id: 99,
    role: "ADMIN",
    email: "admin@example.com",
};

describe("NHF Routine task deletion", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$queryRaw.mockResolvedValue(asNever([]));
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            id: 99,
            role: "ADMIN",
            isActive: true,
            deletedAt: null,
            employee: null,
        }));
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever({
            id: 71,
            title: "ตรวจสอบระบบ",
            version: 3,
        }));
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([
            { id: 91 },
            { id: 92 },
        ]));
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([
            { id: 501, eventKey: "routine:91:rule:31:version:1" },
            { id: 502, eventKey: "routine:92:rule:31:version:1" },
        ]));
        prismaMock.auditLog.create.mockResolvedValue(asNever({ id: 1 }));
    });

    it("cleans scoped dependencies and invalidates pending reminder outbox rows", async () => {
        await deleteRoutineTask(71, adminActor);

        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: {
                id: { in: [501, 502] },
                status: { in: ["PENDING", "PROCESSING", "FAILED"] },
            },
            data: {
                status: "SUPERSEDED",
                lastError: "Routine task was deleted",
            },
        });
        expect(prismaMock.notificationOutbox.findMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                OR: [
                    { eventKey: { startsWith: "routine:91:" } },
                    { eventKey: { startsWith: "routine:92:" } },
                ],
            }),
            select: { id: true, eventKey: true },
        });
        expect(prismaMock.routineOccurrenceAssignee.deleteMany).toHaveBeenCalledWith({
            where: { occurrenceId: { in: [91, 92] } },
        });
        expect(prismaMock.routineOccurrence.deleteMany).toHaveBeenCalledWith({ where: { taskId: 71 } });
        expect(prismaMock.routineTaskAssignee.deleteMany).toHaveBeenCalledWith({ where: { taskId: 71 } });
        expect(prismaMock.routineReminderRule.deleteMany).toHaveBeenCalledWith({ where: { taskId: 71 } });
        expect(prismaMock.routineImportRow.updateMany).toHaveBeenCalledWith({
            where: { appliedTaskId: 71 },
            data: { appliedTaskId: null },
        });
        expect(prismaMock.routineImportLedger.updateMany).toHaveBeenCalledWith({
            where: { taskId: 71 },
            data: { taskId: null },
        });
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "ROUTINE_TASK_DELETE",
                entityType: "RoutineTask",
                entityId: 71,
            }),
        });
        expect(prismaMock.routineTask.delete).toHaveBeenCalledWith({ where: { id: 71 } });
    });

    it("returns not found when another administrator already deleted the task", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(null);

        await expect(deleteRoutineTask(71, adminActor)).rejects.toMatchObject({
            statusCode: 404,
            code: "NOT_FOUND",
        });
        expect(prismaMock.routineTask.delete).not.toHaveBeenCalled();
    });

    it("returns not found for a regular user accessing another user's task", async () => {
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            id: 5,
            role: "USER",
            isActive: true,
            deletedAt: null,
            employee: { id: 21, status: "ACTIVE", deletedAt: null },
        }));

        await expect(deleteRoutineTask(71, { ...adminActor, id: 5, role: "USER" }))
            .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
        expect(prismaMock.routineTask.findUnique).not.toHaveBeenCalled();
    });

    it("does not let an assigned non-creator delete an Admin-created task", async () => {
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            id: 5,
            role: "USER",
            isActive: true,
            deletedAt: null,
            employee: { id: 21, status: "ACTIVE", deletedAt: null },
        }));
        prismaMock.routineTask.findFirst.mockResolvedValue(null);

        await expect(
            deleteRoutineTask(71, { ...adminActor, id: 5, role: "USER" }),
        ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
        expect(prismaMock.routineTask.delete).not.toHaveBeenCalled();
    });

    it("keeps creator deletion available for a self-service task", async () => {
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            id: 5,
            role: "USER",
            isActive: true,
            deletedAt: null,
            employee: { id: 21, status: "ACTIVE", deletedAt: null },
        }));
        prismaMock.routineTask.findFirst.mockResolvedValue(asNever({
            id: 71,
            title: "งานของฉัน",
            version: 1,
            createdById: 5,
        }));
        prismaMock.routineOccurrence.findMany.mockResolvedValue(asNever([]));

        await deleteRoutineTask(71, { ...adminActor, id: 5, role: "USER" });

        expect(prismaMock.routineTask.delete).toHaveBeenCalledWith({ where: { id: 71 } });
    });
});
