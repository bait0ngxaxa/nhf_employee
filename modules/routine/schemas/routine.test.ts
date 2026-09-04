import { describe, expect, it } from "vitest";

import {
    parseRoutineScheduleConfig,
    routineTaskCreateSchema,
    routineTaskSelfServiceCreateSchema,
    routineTaskSelfServiceUpdateSchema,
    routineReminderOutboxPayloadSchema,
} from "./routine";
import { routineImportRowUpdateSchema } from "./import";

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

    it("keeps LIFF self-service schemas free of assignee and import fields", () => {
        const valid = routineTaskSelfServiceCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานของฉัน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
        });
        expect(valid.success).toBe(true);
        if (valid.success) {
            expect(valid.data).not.toHaveProperty("assignees");
            expect(valid.data).not.toHaveProperty("sourceFileName");
        }

        expect(
            routineTaskSelfServiceCreateSchema.safeParse({
                unitId: 1,
                categoryId: 1,
                title: "งานของฉัน",
                scheduleType: "MANUAL",
                scheduleConfig: {},
                assignees: [{ employeeId: 999, role: "OWNER" }],
            }).success,
        ).toBe(false);
        expect(
            routineTaskSelfServiceUpdateSchema.safeParse({
                version: 1,
                sourceSheet: "Spoof",
            }).success,
        ).toBe(false);
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
                    daysBefore: 365,
                    sendHour: 9,
                    channel: "IN_APP",
                    recipientScope: "ASSIGNEES",
                    isActive: true,
                },
            ],
        });
        expect(task.success).toBe(true);

        const validPayload = routineReminderOutboxPayloadSchema.safeParse({
            occurrenceId: 1,
            taskId: 2,
            ruleId: 3,
            reminderVersion: 1,
            dueDate: "2026-08-05",
            scheduledFor: "2026-08-03T02:00:00.000Z",
            createdAt: "2026-08-01T02:00:00.000Z",
        });
        expect(validPayload.success).toBe(true);
        if (validPayload.success) {
            expect(Object.keys(validPayload.data)).not.toContain("expected" + "Status");
        }

        expect(
            routineReminderOutboxPayloadSchema.safeParse({
                occurrenceId: 1,
                taskId: 2,
                ruleId: 3,
                reminderVersion: 1,
                dueDate: "2026-08-05",
                createdAt: "",
            }).success,
        ).toBe(false);
    });

    it.each([
        ["2026-02-29", false],
        ["2024-02-29", true],
        ["2026-02-31", false],
    ])("validates calendar date %s", (date, expected) => {
        const result = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "ONE_TIME",
            scheduleConfig: { date },
            assignees: [{ employeeId: 11, role: "OWNER" }],
        });
        expect(result.success).toBe(expected);
    });

    it("rejects an invalid yearly month/day combination and a missing one-time date", () => {
        const yearly = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "YEARLY_DATE",
            scheduleConfig: { month: 2, day: 30 },
            assignees: [{ employeeId: 11, role: "OWNER" }],
        });
        const oneTime = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานครั้งเดียว",
            scheduleType: "ONE_TIME",
            scheduleConfig: {},
            assignees: [{ employeeId: 11, role: "OWNER" }],
        });

        expect(yearly.success).toBe(false);
        expect(oneTime.success).toBe(false);
    });

    it("does not turn a cleared required schedule number into zero", () => {
        const result = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: "", monthOffset: 0 },
            assignees: [{ employeeId: 11, role: "OWNER" }],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: ["scheduleConfig", "day"],
                    message: "กรุณาระบุวันที่ตั้งแต่ 1 ถึง 31",
                }),
            ]));
        }
    });

    it("returns a specific inline error for an invalid yearly month", () => {
        const result = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "YEARLY_DATE",
            scheduleConfig: { month: 13, day: 10 },
            assignees: [{ employeeId: 11, role: "OWNER" }],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: ["scheduleConfig", "month"],
                    message: "กรุณาระบุเดือนตั้งแต่ 1 ถึง 12",
                }),
            ]));
        }
    });

    it("keeps schedule field errors specific in the import row editor", () => {
        const result = routineImportRowUpdateSchema.safeParse({
            version: 1,
            categoryName: "ระบบคอมพิวเตอร์",
            title: "งานประจำ",
            mappedAssignees: [{ employeeId: 11, role: "OWNER" }],
            scheduleText: null,
            scheduleType: "YEARLY_DATE",
            scheduleConfig: { month: 13, day: 10 },
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: ["scheduleConfig", "month"],
                    message: "กรุณาระบุเดือนตั้งแต่ 1 ถึง 12",
                }),
            ]));
        }
    });

    it("rejects cleared reminder day and time values instead of coercing them to zero", () => {
        const result = routineTaskCreateSchema.safeParse({
            unitId: 1,
            categoryId: 1,
            title: "งานประจำ",
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            assignees: [{ employeeId: 11, role: "OWNER" }],
            reminderRules: [{
                daysBefore: "",
                sendHour: "",
                channel: "IN_APP",
                recipientScope: "ASSIGNEES",
                isActive: true,
            }],
        });

        expect(result.success).toBe(false);
    });
});
