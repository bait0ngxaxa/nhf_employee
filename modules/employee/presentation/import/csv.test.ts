import { afterEach, describe, expect, it, vi } from "vitest";

import {
    generateSampleCSV,
    downloadSampleCSV,
    parseCSV,
    parseEmployeeStatus,
} from "./csv";

afterEach(() => {
    vi.restoreAllMocks();
});

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

    it("supports BOM, Thai/English aliases, quoted commas, and blank optional fields", () => {
        const parsed = parseCSV([
            "\uFEFFFirst Name,Last Name,Position,Dept,Email,Phone,Affiliation,Nickname,Status",
            'Alice,"Doe, Jr",Developer,ADMIN,,,,,active',
        ].join("\n"));

        expect(parsed).toEqual([{
            sourceRow: 2,
            firstName: "Alice",
            lastName: "Doe, Jr",
            position: "Developer",
            department: "ADMIN",
            status: "active",
        }]);
    });

    it("rejects CSV files that omit a required header", () => {
        expect(() => parseCSV([
            "ชื่อ,นามสกุล,ตำแหน่ง",
            "สมชาย,ใจดี,นักพัฒนา",
        ].join("\n"))).toThrow("ไม่พบคอลัมน์ที่จำเป็น");
    });

    it.each([
        [undefined, "ACTIVE"],
        ["", "ACTIVE"],
        ["-", "ACTIVE"],
        ["active", "ACTIVE"],
        ["ปกติ", "ACTIVE"],
        ["inactive", "INACTIVE"],
        ["ลาออก", "INACTIVE"],
        ["suspended", "SUSPENDED"],
        ["ถูกระงับ", "SUSPENDED"],
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
        const sample = generateSampleCSV();

        expect(sample).toBe([
            "\uFEFFลำดับ,ชื่อ,นามสกุล,ชื่อเล่น,ตำแหน่ง,สังกัด,แผนก,อีเมล,เบอร์โทร,สถานะ",
            "1,สมชาย,ใจดี,ชาย,ผู้จัดการ,สำนักงานใหญ่,บริหาร,somchai@thainhf.org,081-234-5678,ปกติ",
            "2,สมหญิง,รักงาน,หญิง,อาจารย์,คณะวิทยาศาสตร์,วิชาการ,,082-345-6789,ปกติ",
            "3,เจษฎา,รักเรียน,เจ,ครู,โรงเรียนประถม,ADMIN,,081-111-2222,ปกติ",
        ].join("\n"));
        expect(sample).not.toContain("@company.com");
    });

    it("preserves the sample CSV filename", () => {
        const link = {
            click: vi.fn(),
            setAttribute: vi.fn(),
            style: {},
        } as unknown as HTMLAnchorElement;

        vi.spyOn(document, "createElement").mockReturnValue(link);
        vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:employee-sample");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

        downloadSampleCSV();

        expect(link.setAttribute).toHaveBeenCalledWith(
            "download",
            "ตัวอย่างข้อมูลพนักงาน.csv",
        );
    });
});
