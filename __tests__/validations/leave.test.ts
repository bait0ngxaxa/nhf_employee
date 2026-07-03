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
});
