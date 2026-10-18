import { afterEach, describe, expect, it, vi } from "vitest";

import {
    generateSampleCSV,
    downloadSampleCSV,
    generateFailedRowsCSV,
    parseCSV,
    parseEmployeeStatus,
    validateEmployeeImportRows,
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

    it("parses escaped quotes, embedded newlines, CRLF, and original physical row numbers", () => {
        const parsed = parseCSV([
            "\uFEFFชื่อ,นามสกุล,ตำแหน่ง,แผนก,สังกัด,ชื่อเล่น",
            'สมชาย,"ใจดี ""ผู้ช่วย""",นักพัฒนา,ADMIN,"ฝ่าย, ส่วนกลาง","ชื่อ',
            'เล่น"',
            "สมหญิง,รักงาน,นักพัฒนา,ACADEMIC,,",
        ].join("\r\n"));

        expect(parsed).toEqual([
            {
                sourceRow: 2,
                firstName: "สมชาย",
                lastName: 'ใจดี "ผู้ช่วย"',
                position: "นักพัฒนา",
                department: "ADMIN",
                affiliation: "ฝ่าย, ส่วนกลาง",
                nickname: "ชื่อ\nเล่น",
            },
            {
                sourceRow: 4,
                firstName: "สมหญิง",
                lastName: "รักงาน",
                position: "นักพัฒนา",
                department: "ACADEMIC",
            },
        ]);
    });

    it.each([
        ["unclosed quote", '"สมชาย,ใจดี,นักพัฒนา,ADMIN', "เครื่องหมายคำพูดไม่ครบคู่"],
        ["quote in an unquoted field", 'สม"ชาย,ใจดี,นักพัฒนา,ADMIN', "ตำแหน่งที่ไม่ถูกต้อง"],
        ["content after a quoted value", '"สมชาย"x,ใจดี,นักพัฒนา,ADMIN', "มีข้อมูลต่อท้าย"],
        ["misaligned columns", "สมชาย,ใจดี,นักพัฒนา,ADMIN,extra", "มี 5 คอลัมน์"],
    ])("rejects CSV formatting that could misalign values (%s)", (_case, row, expectedError) => {
        expect(() => parseCSV([
            "ชื่อ,นามสกุล,ตำแหน่ง,แผนก",
            row,
        ].join("\n"))).toThrow(expectedError);
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

    it("parses the published sample CSV without shifting its mapped columns", () => {
        const parsed = parseCSV(generateSampleCSV());

        expect(parsed).toHaveLength(3);
        expect(parsed[0]).toMatchObject({
            sourceRow: 2,
            firstName: "สมชาย",
            position: "ผู้จัดการ",
            department: "บริหาร",
            email: "somchai@thainhf.org",
        });
    });

    it("reports required values, email, department, status, and batch duplicates by source row", () => {
        const employees = [
            {
                sourceRow: 2,
                firstName: "สมชาย",
                lastName: "ใจดี",
                position: "เจ้าหน้าที่",
                department: "ADMIN",
                email: "STAFF@THAINHF.ORG",
            },
            {
                sourceRow: 8,
                firstName: "สมชาย ",
                lastName: " ใจดี",
                position: "เจ้าหน้าที่",
                department: "ADMIN",
                email: "staff@thainhf.org",
            },
            {
                sourceRow: 11,
                firstName: "",
                lastName: "นามสกุล",
                position: "ตำแหน่ง",
                department: "UNSUPPORTED",
                email: "person@example.com",
                status: "inactiv",
            },
        ];

        const issues = validateEmployeeImportRows(employees);

        expect(issues).toHaveLength(3);
        expect(issues.find(({ sourceRow }) => sourceRow === 2)?.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "email", message: "อีเมลซ้ำกับแถว 8" }),
                expect.objectContaining({ field: "firstName", message: "ชื่อและนามสกุลซ้ำกับแถว 8" }),
            ]),
        );
        expect(issues.find(({ sourceRow }) => sourceRow === 8)?.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "email", message: "อีเมลซ้ำกับแถว 2" }),
                expect.objectContaining({ field: "firstName", message: "ชื่อและนามสกุลซ้ำกับแถว 2" }),
            ]),
        );
        expect(issues.find(({ sourceRow }) => sourceRow === 11)?.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "firstName", message: "กรุณากรอกชื่อ" }),
                expect.objectContaining({ field: "email", message: "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น" }),
                expect.objectContaining({ field: "department", message: expect.stringContaining("ADMIN") }),
                expect.objectContaining({ field: "status", message: expect.stringContaining("สถานะพนักงาน") }),
            ]),
        );
    });

    it("exports every failed row and protects spreadsheet formula values", () => {
        const errors = Array.from({ length: 51 }, (_, index) => ({
            row: index + 2,
            data: {
                firstName: index === 50 ? "=HYPERLINK(\"https://example.com\")" : "ชื่อ" + index,
                lastName: "นามสกุล",
                position: "ตำแหน่ง",
                department: "ADMIN",
            },
            error: "ตรวจสอบไม่ผ่าน",
        }));

        const csv = generateFailedRowsCSV(errors);

        expect(csv).toContain("\uFEFF\"แถวต้นฉบับ CSV\"");
        expect(csv).toContain("\"52\",\"'=HYPERLINK(\"\"https://example.com\"\")\"");
        expect(csv.match(/ตรวจสอบไม่ผ่าน/g)).toHaveLength(51);
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
