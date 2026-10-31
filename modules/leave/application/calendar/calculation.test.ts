import { afterEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Prisma } from "@prisma/client";
import { calculateEffectiveLeaveInTransaction, isHolidayCalendarEnforced } from "./calculation";

describe("effective calendar rollout and missing-year policy", () => {
    afterEach(() => vi.unstubAllEnvs());
    it("explicit setup mode preserves legacy calculation without requiring calendar persistence", async () => {
        vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "false");
        const tx = mockDeep<Prisma.TransactionClient>();
        expect(await calculateEffectiveLeaveInTransaction(tx, "2026-11-02", "2026-11-06", "FULL_DAY")).toMatchObject({ mode: "SETUP_WEEKDAYS", durationHalfDays: 10, calendarVersionId: null });
        expect(tx.holidayCalendar.findUnique).not.toHaveBeenCalled();
    });
    it("fails closed once enforcement is active and no calendar is published", async () => {
        vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "true");
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.holidayCalendar.findUnique.mockResolvedValue(null);
        await expect(calculateEffectiveLeaveInTransaction(tx, "2028-01-04", "2028-01-04", "MORNING")).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("2571") });
        expect(tx.$queryRaw).toHaveBeenCalled();
    });
    it("does not silently disable enforcement for malformed environment values", () => {
        vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "TRUE");
        expect(isHolidayCalendarEnforced).toThrow();
    });
});
