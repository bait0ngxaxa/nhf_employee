import { describe, expect, it } from "vitest";
import { parseHolidayDateList } from "./import";

describe("verified holiday TSV input", () => {
    it("preserves Thai text, citations and notes without publication", () => {
        expect(parseHolidayDateList("2027-01-04\tวันหยุดทดสอบ\tORGANIZATION\tมติทดสอบ\tหมายเหตุ", 2027)).toEqual([{ date: "2027-01-04", name: "วันหยุดทดสอบ", category: "ORGANIZATION", source: "มติทดสอบ", note: "หมายเหตุ" }]);
    });
    it.each(["", "2027-02-30\tทดสอบ\tOFFICIAL\tอ้างอิง", "2026-01-01\tทดสอบ\tOFFICIAL\tอ้างอิง", "2027-01-01\tทดสอบ\tOFFICIAL\t", "2027-01-01\tทดสอบ\tUNKNOWN\tอ้างอิง", "2027-01-01,ทดสอบ,OFFICIAL,อ้างอิง"])("rejects incomplete or invalid input %s", (input) => {
        expect(() => parseHolidayDateList(input, 2027)).toThrow();
    });
    it("rejects duplicate dates before saving", () => {
        const line = "2027-01-04\tวันทดสอบ\tOFFICIAL\tอ้างอิง";
        expect(() => parseHolidayDateList(`${line}\n${line}`, 2027)).toThrow("ซ้ำ");
    });
});
