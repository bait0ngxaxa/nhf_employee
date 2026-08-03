import { describe, expect, it } from "vitest";

import {
    parseRoutineScheduleConfig,
    routineTaskCreateSchema,
    routineReminderOutboxPayloadSchema,
} from "@/lib/validations/routine";

describe("NHF Routine validation", () => {
    it("accepts the supported schedule config shapes", () => {
        expect(
            parseRoutineScheduleConfig("MONTHLY_DAY", {
                day: 31,
                monthOffset: 1,
            }),
        ).toEqual({ day: 31, monthOffset: 1 });
        expect(
            parseRoutineScheduleConfig("MONTH_END", {}),
        ).toEqual({});
        expect(
            parseRoutineScheduleConfig("INTERVAL_MONTHS", {
                intervalMonths: 3,
                anchorDate: "2026-01-01",
            }),
        ).toEqual({ intervalMonths: 3, anchorDate: "2026-01-01" });
        expect(
            parseRoutineScheduleConfig("YEARLY_DATE", { month: 3, day: 31 }),
        ).toEqual({ month: 3, day: 31 });
        expect(
            parseRoutineScheduleConfig("ONE_TIME", { date: "2026-07-21" }),
        ).toEqual({ date: "2026-07-21" });
        expect(parseRoutineScheduleConfig("MANUAL", {})).toEqual({});
    });

    it("requires exactly one owner and rejects invalid contract ranges", () => {
        const result = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            contractStartDate: "2026-08-31",
            contractEndDate: "2026-08-01",
            assignees: [
                { employeeId: 11, role: "CO_OWNER" },
                { employeeId: 11, role: "CO_OWNER" },
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((issue) => issue.message);
            expect(messages).toContain("ผู้รับผิดชอบซ้ำกันไม่ได้");
            expect(messages).toContain("ต้องมีผู้รับผิดชอบหลัก 1 คน");
            expect(messages).toContain("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา");
        }
    });

    it("validates reminder rules and outbox identity payloads", () => {
        const task = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            assignees: [{ employeeId: 11, role: "OWNER" }],
            reminderRules: [
                {
                    daysBefore: 3,
                    sendHour: 9,
                    channel: "IN_APP",
                    recipientScope: "ASSIGNEES",
                    isActive: true,
                },
            ],
        });
        expect(task.success).toBe(true);

        expect(
            routineReminderOutboxPayloadSchema.safeParse({
                occurrenceId: 1,
                taskId: 2,
                ruleId: 3,
                reminderVersion: 1,
                dueDate: "2026-08-05",
                expectedStatus: "TODO",
                createdAt: "2026-08-01T02:00:00.000Z",
            }).success,
        ).toBe(true);

        expect(
            routineReminderOutboxPayloadSchema.safeParse({
                occurrenceId: 1,
                taskId: 2,
                ruleId: 3,
                reminderVersion: 1,
                dueDate: "2026-08-05",
                expectedStatus: "TODO",
                createdAt: "",
            }).success,
        ).toBe(false);
    });
});
