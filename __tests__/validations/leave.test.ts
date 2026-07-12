import { afterEach, describe, expect, it } from "vitest";

import { leaveRequestSchema } from "@/lib/validations/leave";

const ORIGINAL_TIMEZONE = process.env.TZ;

describe("leaveRequestSchema", () => {
    afterEach(() => {
        if (ORIGINAL_TIMEZONE === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = ORIGINAL_TIMEZONE;
        }
    });

    it("rejects date-only requests that cross calendar years", () => {
        process.env.TZ = "America/New_York";

        const result = leaveRequestSchema.safeParse({
            leaveType: "VACATION",
            startDate: "2030-12-31",
            endDate: "2031-01-01",
            period: "FULL_DAY",
            reason: "ขอลาข้ามปี",
        });

        expect(result.success).toBe(false);
    });

    it("rejects a whitespace-only leave reason", () => {
        const result = leaveRequestSchema.safeParse({
            leaveType: "SICK",
            startDate: "2030-05-10",
            endDate: "2030-05-10",
            period: "FULL_DAY",
            reason: "     ",
        });

        expect(result.success).toBe(false);
    });

    it("rejects a leave reason longer than 1000 characters", () => {
        const result = leaveRequestSchema.safeParse({
            leaveType: "SICK",
            startDate: "2030-05-10",
            endDate: "2030-05-10",
            period: "FULL_DAY",
            reason: "a".repeat(1001),
        });

        expect(result.success).toBe(false);
    });

    it("trims a valid leave reason", () => {
        const result = leaveRequestSchema.safeParse({
            leaveType: "SICK",
            startDate: "2030-05-10",
            endDate: "2030-05-10",
            period: "FULL_DAY",
            reason: "  Valid reason  ",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.reason).toBe("Valid reason");
        }
    });

    it("rejects timestamps instead of date-only leave dates", () => {
        const result = leaveRequestSchema.safeParse({
            leaveType: "SICK",
            startDate: "2030-05-10T00:00:00.000Z",
            endDate: "2030-05-10T12:00:00.000Z",
            period: "MORNING",
            reason: "Valid reason",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe("รูปแบบวันที่ไม่ถูกต้อง");
        }
    });
});
