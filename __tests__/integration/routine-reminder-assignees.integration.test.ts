import type { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    addCalendarDays,
    getCurrentBangkokDate,
    getRoutineReminderScheduledFor,
    toBangkokCalendarDate,
} from "@/modules/routine";
import {
    createRoutineTaskInTransaction,
    updateRoutineOccurrenceOverride,
    updateRoutineTask,
} from "@/modules/routine";
import {
    buildRoutineContractExpiryEventKey,
    buildRoutineReminderEventKey,
    dispatchRoutineReminderOutbox,
    runRoutineScheduler,
} from "@/modules/routine";
import type { RoutineCommandActor } from "@/modules/routine";
import { routineReminderEmailOutboxPayloadSchema } from "@/modules/routine";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function cleanRoutineReminderDatabase(): Promise<void> {
    await prisma.notificationOutbox.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.routineOccurrenceAssignee.deleteMany();
    await prisma.routineOccurrence.deleteMany();
    await prisma.routineReminderRule.deleteMany();
    await prisma.routineTaskAssignee.deleteMany();
    await prisma.routineTaskCreateIdempotency.deleteMany();
    await prisma.routineTask.deleteMany();
    await prisma.routineCategory.deleteMany();
    await prisma.routineUnit.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.userCapabilityGrant.deleteMany({
        where: { user: { email: "routine-reminder-admin@integration.test" } },
    });
    await prisma.user.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
}

interface RoutineReminderFixture {
    actor: RoutineCommandActor;
    categoryId: number;
    ownerEmployeeId: number;
    ownerUserId: number;
    ownerEmail: string;
    coOwnerEmployeeId: number;
    coOwnerUserId: number;
    coOwnerEmail: string;
    unitId: number;
}

async function createRoutineReminderFixture(): Promise<RoutineReminderFixture> {
    const department = await prisma.department.create({
        data: {
            name: "แผนกทดสอบ Routine Reminder",
            code: "RTN-REMINDER-TEST",
        },
    });
    const ownerEmail = "routine-owner@integration.test";
    const coOwnerEmail = "routine-co-owner@integration.test";
    const [ownerEmployee, coOwnerEmployee, actorEmployee] = await Promise.all([
        prisma.employee.create({
            data: {
                firstName: "เจ้าของงาน",
                lastName: "ทดสอบ",
                email: "routine-owner-employee@integration.test",
                position: "เจ้าหน้าที่ทดสอบ",
                departmentId: department.id,
            },
        }),
        prisma.employee.create({
            data: {
                firstName: "ผู้รับผิดชอบร่วม",
                lastName: "ทดสอบ",
                email: "routine-co-owner-employee@integration.test",
                position: "เจ้าหน้าที่ทดสอบ",
                departmentId: department.id,
            },
        }),
        prisma.employee.create({
            data: {
                firstName: "ผู้ดูแล Routine Reminder",
                lastName: "ทดสอบ",
                email: "routine-reminder-admin-employee@integration.test",
                position: "ผู้ดูแลทดสอบ",
                departmentId: department.id,
                status: "ACTIVE",
                deletedAt: null,
            },
        }),
    ]);
    const [ownerUser, coOwnerUser, admin] = await Promise.all([
        prisma.user.create({
            data: {
                email: ownerEmail,
                name: "เจ้าของงาน ทดสอบ",
                password: "integration-test-only",
                employeeId: ownerEmployee.id,
            },
        }),
        prisma.user.create({
            data: {
                email: coOwnerEmail,
                name: "ผู้รับผิดชอบร่วม ทดสอบ",
                password: "integration-test-only",
                employeeId: coOwnerEmployee.id,
            },
        }),
        prisma.user.create({
            data: {
                email: "routine-reminder-admin@integration.test",
                name: "ผู้ดูแล Routine Reminder",
                password: "integration-test-only",
                role: "ADMIN",
                employeeId: actorEmployee.id,
            },
        }),
    ]);
    await prisma.userCapabilityGrant.createMany({
        data: [
            {
                userId: admin.id,
                capabilityKey: "routine.task.create",
                scope: "ALL",
            },
            {
                userId: admin.id,
                capabilityKey: "routine.task.update",
                scope: "ALL",
            },
            {
                userId: admin.id,
                capabilityKey: "routine.occurrence.override",
                scope: "ALL",
            },
        ],
    });
    const [unit, category] = await Promise.all([
        prisma.routineUnit.create({
            data: { code: "RTN-REMINDER", name: "หน่วยงานทดสอบ Reminder" },
        }),
        prisma.routineCategory.create({
            data: { name: "หมวดหมู่ทดสอบ Reminder", sortOrder: 1 },
        }),
    ]);

    return {
        actor: {
            id: admin.id,
            employeeIdHint: actorEmployee.id,
            email: admin.email,
            role: "ADMIN",
            ipAddress: "192.0.2.10",
            userAgent: "routine-reminder-integration-test",
            requestId: "routine-reminder-integration",
            correlationId: "routine-reminder-integration",
        },
        categoryId: category.id,
        ownerEmployeeId: ownerEmployee.id,
        ownerUserId: ownerUser.id,
        ownerEmail,
        coOwnerEmployeeId: coOwnerEmployee.id,
        coOwnerUserId: coOwnerUser.id,
        coOwnerEmail,
        unitId: unit.id,
    };
}

function routineTaskInput(
    fixture: RoutineReminderFixture,
    dueDate: string,
    includeCoOwner: boolean,
    contractEndDate?: string,
) {
    return {
        unitId: fixture.unitId,
        categoryId: fixture.categoryId,
        title: "ตรวจสอบระบบหลายผู้รับผิดชอบ",
        scheduleType: "ONE_TIME" as const,
        scheduleConfig: { date: dueDate },
        ...(contractEndDate ? { contractEndDate } : {}),
        businessDayPolicy: "NONE" as const,
        isActive: true,
        assignees: [
            { employeeId: fixture.ownerEmployeeId, role: "OWNER" as const },
            ...(includeCoOwner
                ? [{
                      employeeId: fixture.coOwnerEmployeeId,
                      role: "CO_OWNER" as const,
                  }]
                : []),
        ],
        reminderRules: [{
            daysBefore: 2,
            sendHour: 9,
            channel: "IN_APP" as const,
            recipientScope: "ASSIGNEES" as const,
            isActive: true,
        }],
    };
}

async function dispatchOccurrenceReminder(
    occurrence: {
        id: number;
        taskId: number;
        dueDate: Date;
        reminderVersion: number;
        task: { reminderRules: Array<{ id: number; daysBefore: number; sendHour: number }> };
    },
): Promise<void> {
    const rule = occurrence.task.reminderRules[0];
    if (!rule) throw new Error("ไม่พบกฎแจ้งเตือนสำหรับ integration test");
    const dueDate = toBangkokCalendarDate(occurrence.dueDate);
    const scheduledFor = getRoutineReminderScheduledFor(
        dueDate,
        rule.daysBefore,
        rule.sendHour,
    );
    const payload = {
        occurrenceId: occurrence.id,
        taskId: occurrence.taskId,
        ruleId: rule.id,
        reminderVersion: occurrence.reminderVersion,
        dueDate,
        scheduledFor: scheduledFor.toISOString(),
        createdAt: scheduledFor.toISOString(),
    };
    const notification = await prisma.notificationOutbox.create({
        data: {
            type: "ROUTINE_REMINDER_IN_APP",
            eventKey: buildRoutineReminderEventKey(
                occurrence.id,
                rule.id,
                occurrence.reminderVersion,
            ),
            payload: JSON.stringify(payload),
            status: "PROCESSING",
        },
    });

    await expect(
        dispatchRoutineReminderOutbox(notification, payload, scheduledFor),
    ).resolves.toBe("SENT");
}

async function findOnlyOccurrence(taskId: number) {
    const occurrences = await prisma.routineOccurrence.findMany({
        where: { taskId },
        select: {
            id: true,
            taskId: true,
            dueDate: true,
            originalDueDate: true,
            isDueDateOverridden: true,
            scheduleVersion: true,
            reminderVersion: true,
            assignees: {
                select: { employeeId: true, role: true },
                orderBy: { employeeId: "asc" },
            },
            task: {
                select: {
                    reminderRules: {
                        select: { id: true, daysBefore: true, sendHour: true },
                    },
                },
            },
        },
    });
    expect(occurrences).toHaveLength(1);
    const occurrence = occurrences[0];
    if (!occurrence) throw new Error("ไม่พบ occurrence สำหรับ integration test");
    return occurrence;
}

async function expectRecipientDeliveries(
    expectedRecipients: ReadonlyArray<{ userId: number; email: string }>,
): Promise<void> {
    const notifications = await prisma.notification.findMany({
        where: { type: "ROUTINE_REMINDER" },
        select: { userId: true },
        orderBy: { userId: "asc" },
    });
    expect(notifications.map((notification) => notification.userId)).toEqual(
        expectedRecipients.map((recipient) => recipient.userId).sort((left, right) => left - right),
    );

    const emailRows = await prisma.notificationOutbox.findMany({
        where: { type: "ROUTINE_REMINDER_EMAIL" },
        select: { eventKey: true, payload: true },
        orderBy: { eventKey: "asc" },
    });
    expect(emailRows).toHaveLength(expectedRecipients.length);
    expect(new Set(emailRows.map((row) => row.eventKey)).size).toBe(
        expectedRecipients.length,
    );
    const emailPayloads = emailRows.map((row) =>
        routineReminderEmailOutboxPayloadSchema.parse(
            JSON.parse(row.payload) as unknown,
        ),
    );
    expect(emailPayloads.map((payload) => ({
        userId: payload.userId,
        email: payload.to,
    })).sort((left, right) => left.userId - right.userId)).toEqual(
        [...expectedRecipients].sort((left, right) => left.userId - right.userId),
    );
}

describe("Routine reminder multiple-assignee integration", () => {
    beforeEach(async () => {
        assertDedicatedDatabase();
        await cleanRoutineReminderDatabase();
    });

    afterAll(async () => {
        await cleanRoutineReminderDatabase();
        await prisma.$disconnect();
    });

    it("persists owner and co-owner snapshots and creates one delivery per user", async () => {
        const fixture = await createRoutineReminderFixture();
        const dueDate = addCalendarDays(getCurrentBangkokDate(), 2);
        const task = await runSerializableTransaction((tx: Prisma.TransactionClient) =>
            createRoutineTaskInTransaction(
                tx,
                routineTaskInput(fixture, dueDate, true),
                fixture.actor,
            ),
        );
        const occurrence = await findOnlyOccurrence(task.id);

        expect(occurrence.assignees).toHaveLength(2);
        expect(occurrence.assignees).toEqual(expect.arrayContaining([
            { employeeId: fixture.ownerEmployeeId, role: "OWNER" },
            { employeeId: fixture.coOwnerEmployeeId, role: "CO_OWNER" },
        ]));

        await dispatchOccurrenceReminder(occurrence);
        await expectRecipientDeliveries([
            { userId: fixture.ownerUserId, email: fixture.ownerEmail },
            { userId: fixture.coOwnerUserId, email: fixture.coOwnerEmail },
        ]);
    });

    it("propagates a newly added co-owner before creating reminder deliveries", async () => {
        const fixture = await createRoutineReminderFixture();
        const dueDate = addCalendarDays(getCurrentBangkokDate(), 2);
        const task = await runSerializableTransaction((tx: Prisma.TransactionClient) =>
            createRoutineTaskInTransaction(
                tx,
                routineTaskInput(fixture, dueDate, false),
                fixture.actor,
            ),
        );

        await updateRoutineTask(
            task.id,
            {
                version: task.version,
                assignees: routineTaskInput(fixture, dueDate, true).assignees,
            },
            fixture.actor,
        );
        const occurrence = await findOnlyOccurrence(task.id);

        expect(occurrence.assignees).toHaveLength(2);
        expect(occurrence.assignees).toEqual(expect.arrayContaining([
            { employeeId: fixture.ownerEmployeeId, role: "OWNER" },
            { employeeId: fixture.coOwnerEmployeeId, role: "CO_OWNER" },
        ]));

        await dispatchOccurrenceReminder(occurrence);
        await expectRecipientDeliveries([
            { userId: fixture.ownerUserId, email: fixture.ownerEmail },
            { userId: fixture.coOwnerUserId, email: fixture.coOwnerEmail },
        ]);
    });

    it("skips an existing reminder outbox event on the next scheduler run", async () => {
        const fixture = await createRoutineReminderFixture();
        const contractEndDate = addCalendarDays(getCurrentBangkokDate(), 2);
        const now = getRoutineReminderScheduledFor(
            getCurrentBangkokDate(),
            0,
            9,
        );
        const dueDate = contractEndDate;
        const task = await runSerializableTransaction((tx: Prisma.TransactionClient) =>
            createRoutineTaskInTransaction(
                tx,
                routineTaskInput(fixture, dueDate, false, contractEndDate),
                fixture.actor,
            ),
        );
        const occurrence = await findOnlyOccurrence(task.id);
        const reminderRule = occurrence.task.reminderRules[0];
        if (!reminderRule) throw new Error("ไม่พบกฎแจ้งเตือนสำหรับ integration test");

        const first = await runRoutineScheduler(now);
        const second = await runRoutineScheduler(now);

        expect(first).toEqual(expect.objectContaining({
            outboxEnqueued: 1,
            duplicatesSkipped: 0,
            contractOutboxEnqueued: 1,
            contractDuplicatesSkipped: 0,
            errors: 0,
        }));
        expect(second).toEqual(expect.objectContaining({
            outboxEnqueued: 0,
            duplicatesSkipped: 1,
            contractOutboxEnqueued: 0,
            contractDuplicatesSkipped: 1,
            errors: 0,
        }));
        const outboxEvents = await prisma.notificationOutbox.findMany({
            where: { type: "ROUTINE_REMINDER_IN_APP" },
            select: { eventKey: true },
        });
        expect(outboxEvents).toEqual([{
            eventKey: buildRoutineReminderEventKey(
                occurrence.id,
                reminderRule.id,
                occurrence.reminderVersion,
            ),
        }]);
        const contractOutboxEvents = await prisma.notificationOutbox.findMany({
            where: { type: "ROUTINE_CONTRACT_EXPIRY_IN_APP" },
            select: { eventKey: true },
        });
        expect(contractOutboxEvents).toEqual([{
            eventKey: buildRoutineContractExpiryEventKey(
                task.id,
                contractEndDate,
            ),
        }]);
    });

    it("generates a single occurrence and outbox event when two schedulers start together", async () => {
        const fixture = await createRoutineReminderFixture();
        const today = getCurrentBangkokDate();
        const dueDate = addCalendarDays(today, 2);
        const input = routineTaskInput(fixture, dueDate, true);
        const task = await prisma.routineTask.create({
            data: {
                ...input,
                createdById: fixture.actor.id,
                updatedById: fixture.actor.id,
                assignees: { create: input.assignees },
                reminderRules: { create: input.reminderRules },
            },
        });
        const now = getRoutineReminderScheduledFor(today, 0, 10);

        const results = await Promise.all([runRoutineScheduler(now), runRoutineScheduler(now)]);

        expect(results.map(({ errors }) => errors)).toEqual([0, 0]);
        expect(results.map(({ occurrencesCreated }) => occurrencesCreated).sort()).toEqual([0, 1]);
        expect(results.map(({ outboxEnqueued }) => outboxEnqueued).sort()).toEqual([0, 1]);
        expect(results.map(({ duplicatesSkipped }) => duplicatesSkipped).sort()).toEqual([0, 1]);
        const occurrence = await findOnlyOccurrence(task.id);
        expect(occurrence.assignees).toHaveLength(2);
        const [rule] = occurrence.task.reminderRules;
        expect(await prisma.notificationOutbox.findMany({ select: { eventKey: true } })).toEqual([{
            eventKey: buildRoutineReminderEventKey(occurrence.id, rule.id, occurrence.reminderVersion),
        }]);
        const repeat = await runRoutineScheduler(now);
        expect(repeat).toMatchObject({ occurrencesCreated: 0, outboxEnqueued: 0, duplicatesSkipped: 1, errors: 0 });
    });

    it("reconciles schedule and assignee updates and preserves an override during scheduler overlap", async () => {
        const fixture = await createRoutineReminderFixture();
        const today = getCurrentBangkokDate();
        const dueDate = addCalendarDays(today, 2);
        const shiftedDueDate = addCalendarDays(today, 3);
        const overrideDueDate = addCalendarDays(today, 4);
        const task = await runSerializableTransaction((tx) =>
            createRoutineTaskInTransaction(tx, routineTaskInput(fixture, dueDate, false), fixture.actor),
        );
        const now = getRoutineReminderScheduledFor(today, 0, 10);

        const [scheduleRace] = await Promise.all([
            runRoutineScheduler(now),
            updateRoutineTask(task.id, {
                version: task.version,
                scheduleType: "ONE_TIME",
                scheduleConfig: { date: shiftedDueDate },
                assignees: [{ employeeId: fixture.coOwnerEmployeeId, role: "OWNER" }],
            }, fixture.actor),
        ]);
        expect(scheduleRace.errors).toBe(0);
        const shifted = await findOnlyOccurrence(task.id);
        expect(toBangkokCalendarDate(shifted.dueDate)).toBe(shiftedDueDate);
        expect(shifted.assignees).toEqual([{ employeeId: fixture.coOwnerEmployeeId, role: "OWNER" }]);
        expect(shifted.scheduleVersion).toBe(task.version + 1);

        const [overrideRace] = await Promise.all([
            runRoutineScheduler(now),
            updateRoutineOccurrenceOverride(shifted.id, {
                dueDate: overrideDueDate,
                expectedReminderVersion: shifted.reminderVersion,
                assignees: [{ employeeId: fixture.ownerEmployeeId, role: "OWNER" }],
            }, fixture.actor),
        ]);
        expect(overrideRace.errors).toBe(0);
        const catchup = getRoutineReminderScheduledFor(overrideDueDate, 1, 10);
        expect(await runRoutineScheduler(catchup)).toMatchObject({ outboxEnqueued: 1, errors: 0 });
        expect(await runRoutineScheduler(catchup)).toMatchObject({ outboxEnqueued: 0, duplicatesSkipped: 1, errors: 0 });

        const occurrence = await findOnlyOccurrence(task.id);
        expect(occurrence.id).toBe(shifted.id);
        expect(toBangkokCalendarDate(occurrence.dueDate)).toBe(overrideDueDate);
        expect(toBangkokCalendarDate(occurrence.originalDueDate)).toBe(shiftedDueDate);
        expect(occurrence.reminderVersion).toBe(shifted.reminderVersion + 1);
        expect(occurrence.assignees).toEqual([{ employeeId: fixture.ownerEmployeeId, role: "OWNER" }]);
        expect(occurrence.isDueDateOverridden).toBe(true);
        const [rule] = occurrence.task.reminderRules;
        const queued = await prisma.notificationOutbox.update({
            where: { eventKey: buildRoutineReminderEventKey(occurrence.id, rule.id, occurrence.reminderVersion) },
            data: { status: "PROCESSING" },
        });
        const payload: unknown = JSON.parse(queued.payload);
        await expect(dispatchRoutineReminderOutbox(queued, payload, catchup)).resolves.toBe("SENT");
        await expectRecipientDeliveries([{ userId: fixture.ownerUserId, email: fixture.ownerEmail }]);
    });
});
