import { describe, expect, it } from "vitest";

import {
    getCurrentLeaveYear,
    getLeaveYearFromDateValue,
} from "@/lib/services/leave/quota-year";

describe("leave quota year helpers", () => {
    it("uses Thailand business year for current-time calculations", () => {
        const bangkokNewYear = new Date("2026-12-31T17:30:00.000Z");

        expect(getCurrentLeaveYear(bangkokNewYear)).toBe(2027);
    });

    it("keeps date-only leave inputs in their selected calendar year", () => {
        expect(getLeaveYearFromDateValue("2030-01-01")).toBe(2030);
        expect(getLeaveYearFromDateValue(new Date("2030-01-01T00:00:00.000Z"))).toBe(2030);
    });
});
