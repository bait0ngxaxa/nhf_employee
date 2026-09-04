import { describe, expect, it } from "vitest";

import {
    excelSerialToCalendarDate,
    normalizeCellDate,
    normalizeSourceYear,
    parseContractDates,
} from "./index";

describe("routine import date normalization", () => {
    it("converts Buddhist years explicitly and preserves Gregorian years", () => {
        expect(normalizeSourceYear(2568)).toBe(2025);
        expect(normalizeSourceYear(2569)).toBe(2026);
        expect(normalizeSourceYear(2025)).toBe(2025);
        expect(normalizeSourceYear(68)).toBe(2025);
    });

    it("parses Thai contract ranges and detects invalid ranges", () => {
        expect(parseContractDates("(14 เม.ย 66 - 31 มี.ค. 69)")).toEqual({
            startDate: "2023-04-14",
            endDate: "2026-03-31",
            reviewReasons: [],
        });
        expect(parseContractDates("ม.ค. 69 - ธ.ค 68").reviewReasons).toContain(
            "CONTRACT_DATE_UNRESOLVED",
        );
    });

    it("supports Excel serial dates without timezone conversion", () => {
        expect(excelSerialToCalendarDate(1)).toBe("1900-01-01");
        expect(excelSerialToCalendarDate(45000)).toBe("2023-03-15");
        expect(normalizeCellDate(45000, "m/d/yy")).toBe("2023-03-15");
    });
});
