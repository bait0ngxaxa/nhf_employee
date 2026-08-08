import { EmployeeStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    generateSampleCSV,
    parseCSV,
    parseEmployeeStatus,
} from "@/lib/helpers/csv-helpers";

describe("Employee CSV helpers", () => {
    it("preserves a non-empty source row with missing required fields", () => {
        const parsed = parseCSV([
            "ชื่อ,นามสกุล,ตำแหน่ง,แผนก,อีเมล",
            "สมชาย,ใจดี,นักพัฒนา,ADMIN,somchai@thainhf.org",
            "สมหญิง,,นักพัฒนา,ADMIN,somying@thainhf.org",
        ].join("\n"));

        expect(parsed).toHaveLength(2);
        expect(parsed[1]).toMatchObject({
            firstName: "สมหญิง",
            lastName: "",
            sourceRow: 3,
        });
    });

    it("preserves original row numbers while intentionally ignoring blank rows", () => {
        const parsed = parseCSV([
            "ชื่อ,นามสกุล,ตำแหน่ง,แผนก",
            "",
            "สมชาย,ใจดี,นักพัฒนา,ADMIN",
        ].join("\n"));

        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.sourceRow).toBe(3);
    });

    it.each([
        [undefined, EmployeeStatus.ACTIVE],
        ["", EmployeeStatus.ACTIVE],
        ["-", EmployeeStatus.ACTIVE],
        ["active", EmployeeStatus.ACTIVE],
        ["ปกติ", EmployeeStatus.ACTIVE],
        ["inactive", EmployeeStatus.INACTIVE],
        ["ลาออก", EmployeeStatus.INACTIVE],
        ["suspended", EmployeeStatus.SUSPENDED],
        ["ถูกระงับ", EmployeeStatus.SUSPENDED],
    ])("maps status %j to %s", (raw, expected) => {
        expect(parseEmployeeStatus(raw)).toBe(expected);
    });

    it.each(["inactiv", "ลาออ", "unknown"])(
        "rejects unknown status %j",
        (raw) => {
            expect(() => parseEmployeeStatus(raw)).toThrow("สถานะ");
        },
    );

    it("uses an organizational email in the sample CSV", () => {
        expect(generateSampleCSV()).toContain("somchai@thainhf.org");
        expect(generateSampleCSV()).not.toContain("@company.com");
    });
});
