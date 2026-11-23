import { expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getRoutineTaskWorkItems, type RoutineOccurrenceFilters } from "@/modules/routine";

it("filters the earliest eligible occurrence before paging, with the complete unfiltered DTO as reference", async () => {
    const fixture = await prisma.$transaction(async (tx) => {
        const department = await tx.department.create({ data: { code: "WORK-ITEM-TEST", name: "Synthetic" } });
        const employee = await tx.employee.create({ data: {
            firstName: "Test", lastName: "Assignee", email: "work-item-employee@integration.test", position: "Test", departmentId: department.id,
        } });
        const user = await tx.user.create({ data: {
            email: "work-item@integration.test", name: "Test", role: "USER", password: "fixture", employeeId: employee.id,
        } });
        await tx.userCapabilityGrant.create({ data: { userId: user.id, capabilityKey: "routine.task.read", scope: "ALL" } });
        const unit = await tx.routineUnit.create({ data: { code: "WORK-ITEM-TEST", name: "Synthetic" } });
        const category = await tx.routineCategory.create({ data: { name: "Work item query test" } });
        const taskFields = { title: "งานทดสอบ", scheduleType: "MANUAL" as const, unitId: unit.id, categoryId: category.id, createdById: user.id, updatedById: user.id };
        return { department, employee, user, unit, category, taskFields };
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-22T17:00:00.000Z")); // Bangkok midnight on 23 November.
    try {
        const dueDays = [[22, 23, 31], [30, 30], [31], [22], [], [24, 30]];
        const taskIds: number[] = [];
        for (const [index, dates] of dueDays.entries()) {
            const task = await prisma.routineTask.create({ data: {
                ...fixture.taskFields,
                ...(index < 2 ? { assignees: { create: { employeeId: fixture.employee.id, role: "OWNER" } } } : {}),
            } });
            taskIds.push(task.id);
            if (dates.length === 0) continue;
            await prisma.routineOccurrence.createMany({ data: dates.map((day, period) => ({
                taskId: task.id, periodKey: `test-${period}`, scheduleVersion: 1,
                dueDate: new Date(Date.UTC(2026, 10, day)),
                originalDueDate: new Date(Date.UTC(2026, 10, index === 1 && period === 0 ? day + 1 : day)),
                isDueDateOverridden: index === 1 && period === 0,
            })) });
        }

        const actor = { actor: { id: fixture.user.id, email: fixture.user.email, role: fixture.user.role }, employeeId: fixture.employee.id };
        const today = "2026-11-23";
        const daySeven = "2026-11-30";
        const dayEight = "2026-12-01";
        const scenarios: Array<{ filters: Partial<RoutineOccurrenceFilters>; taskIndexes: number[] }> = [
            { filters: { timingStatus: "DUE_TODAY" }, taskIndexes: [0] },
            { filters: { timingStatus: "DUE_SOON" }, taskIndexes: [1, 5] },
            { filters: { timingStatus: "UPCOMING" }, taskIndexes: [2] },
            { filters: { timingStatus: "OVERDUE" }, taskIndexes: [] },
            { filters: { timingStatus: "UPCOMING", dueTo: daySeven }, taskIndexes: [] },
            { filters: { timingStatus: "DUE_SOON", dueFrom: daySeven, dueTo: daySeven }, taskIndexes: [1] },
            { filters: { dueFrom: "2026-11-22", dueTo: today }, taskIndexes: [0] },
            { filters: { dueFrom: dayEight, dueTo: dayEight }, taskIndexes: [2] },
            { filters: { scope: "mine", timingStatus: "DUE_SOON" }, taskIndexes: [1] },
            { filters: { scope: "all", assigneeId: fixture.employee.id, dueTo: dayEight }, taskIndexes: [0, 1] },
        ];
        const base = { scope: "all" as const, categoryId: fixture.category.id, page: 1, limit: 20 };
        const reference = await getRoutineTaskWorkItems(base, actor);
        expect(reference.tasks.map(({ id }) => id)).toEqual(taskIds);
        const tied = await prisma.routineOccurrence.findMany({ where: { taskId: taskIds[1] }, orderBy: { id: "asc" } });
        expect(reference.tasks[1]?.relevantOccurrence).toMatchObject({
            id: tied[0]?.id, dueDate: daySeven, originalDueDate: dayEight,
        });

        for (const { filters, taskIndexes } of scenarios) {
            const expected = taskIndexes.map((index) => reference.tasks[index]);
            for (const page of [1, 2, 3]) {
                expect(await getRoutineTaskWorkItems({ ...base, ...filters, page, limit: 1 }, actor)).toEqual({
                    tasks: expected.slice(page - 1, page),
                    pagination: { page, limit: 1, total: expected.length, pages: expected.length },
                });
            }
        }
        const historical = await prisma.routineOccurrence.findFirstOrThrow({ where: { taskId: taskIds[0], periodKey: "test-0" } });
        const focus = { ...base, taskId: historical.taskId, occurrenceId: historical.id };
        expect(await getRoutineTaskWorkItems({ ...focus, timingStatus: "UPCOMING" }, actor))
            .toEqual(await getRoutineTaskWorkItems(focus, actor));
        const mismatchingFocus = await getRoutineTaskWorkItems({ ...focus, taskId: taskIds[1], dueTo: dayEight }, actor);
        expect(mismatchingFocus).toEqual({ tasks: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    } finally {
        vi.useRealTimers();
        await prisma.$transaction([
            prisma.routineTask.deleteMany({ where: { categoryId: fixture.category.id } }),
            prisma.routineCategory.delete({ where: { id: fixture.category.id } }),
            prisma.routineUnit.delete({ where: { id: fixture.unit.id } }),
            prisma.userCapabilityGrant.deleteMany({ where: { userId: fixture.user.id } }),
            prisma.user.delete({ where: { id: fixture.user.id } }),
            prisma.employee.delete({ where: { id: fixture.employee.id } }),
            prisma.department.delete({ where: { id: fixture.department.id } }),
        ]);
    }
});
