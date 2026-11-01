import { describe, expect, it } from "vitest";
import { formatCalendarDate, holidayDisplayName } from "./holiday-display";

describe("reference display localization", () => {
    it("uses verified mappings and preserves unknown English and original Thai titles", () => {
        expect(holidayDisplayName("Chakri Day")).toBe("วันจักรี");
        expect(holidayDisplayName("Songkran Holiday")).toBe("วันสงกรานต์");
        expect(holidayDisplayName("Unknown source title")).toBe("Unknown source title");
        expect(holidayDisplayName("วันปิยมหาราช")).toBe("วันปิยมหาราช");
    });
    it("formats a date-only Bangkok day in Buddhist Era without UTC shifts", () => {
        expect(formatCalendarDate("2026-01-01")).toBe("1 มกราคม 2569");
    });
});
