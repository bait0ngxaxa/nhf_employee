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
    updateRoutineTask,
} from "@/modules/routine";
import {
    buildRoutineReminderEventKey,
    dispatchRoutineReminderOutbox,
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
    await prisma.routineImportRow.deleteMany();
    await prisma.routineImportLedger.deleteMany();
    await prisma.routineTaskCreateIdempotency.deleteMany();
    await prisma.routineTask.deleteMany();
    await prisma.routineImportBatch.deleteMany();
    await prisma.routineCategory.deleteMany();
    await prisma.routineUnit.deleteMany();
    await prisma.auditLog.deleteMany();
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
    const [ownerEmployee, coOwnerEmployee] = await Promise.all([
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
            },
        }),
    ]);
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
) {
    return {
        unitId: fixture.unitId,
        categoryId: fixture.categoryId,
        title: "ตรวจสอบระบบหลายผู้รับผิดชอบ",
        scheduleType: "ONE_TIME" as const,
        scheduleConfig: { date: dueDate },
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
});
