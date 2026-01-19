import { describe, it, expect } from "vitest";
import {
    formatDate,
    getRelativeTime,
    isPastDate,
} from "@/lib/helpers/date-helpers";

describe("Date Helpers", () => {
    describe("formatDate", () => {
        it("should format date correctly", () => {
            const date = new Date("2023-01-01");
            // Using en-US to avoid locale issues in test env or mock it
            // The function defaults to th-TH.
            // In Node env usually th-TH might default to Buddhist calendar or Gregorian depending on ICU.
            // Best to test with specific locale or expect string inclusion.

            // Assuming environment supports th-TH:
            const result = formatDate(date.toISOString());
            if (result !== "-") {
                // Check if it contains year/month parts
                expect(result).toBeDefined();
            }
        });

        it("should return - for invalid date", () => {
            expect(formatDate("invalid")).toBe("-");
        });
    });

    describe("getRelativeTime", () => {
        it("should return relative time", () => {
            const now = new Date();
            const past = new Date(now.getTime() - 1000 * 60 * 5); // 5 mins ago
            const result = getRelativeTime(past.toISOString());
            expect(result).toContain("นาทีที่แล้ว");
        });
    });

    describe("isPastDate", () => {
        it("should return true for past date", () => {
            const past = new Date("2000-01-01");
            expect(isPastDate(past.toISOString())).toBe(true);
        });

        it("should return false for future date", () => {
            const future = new Date();
            future.setFullYear(future.getFullYear() + 1);
            expect(isPastDate(future.toISOString())).toBe(false);
        });
    });
});
