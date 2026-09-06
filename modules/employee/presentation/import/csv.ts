import { parseEmployeeImportStatus } from "../../domain/import-status";
import type { EmployeeStatusValue } from "../../domain/lifecycle";
import type { CSVEmployee } from "./types";

export const CSV_HEADER_MAPPINGS: Record<string, keyof CSVEmployee> = {
    ชื่อ: "firstName",
    firstname: "firstName",
    "first name": "firstName",
    นามสกุล: "lastName",
    lastname: "lastName",
    "last name": "lastName",
    อีเมล: "email",
    email: "email",
    "e-mail": "email",
    เบอร์โทรศัพท์: "phone",
    เบอร์โทร: "phone",
    phone: "phone",
    telephone: "phone",
    ตำแหน่ง: "position",
    position: "position",
    แผนก: "department",
    department: "department",
    dept: "department",
    สังกัด: "affiliation",
    affiliation: "affiliation",
    ชื่อเล่น: "nickname",
    nickname: "nickname",
    nick: "nickname",
    สถานะ: "status",
    status: "status",
};

export const CSV_REQUIRED_FIELDS: (keyof CSVEmployee)[] = [
    "firstName",
    "lastName",
    "position",
    "department",
];

export function parseEmployeeStatus(raw: string | undefined): EmployeeStatusValue {
    return parseEmployeeImportStatus(raw);
}

export function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result.map((field) => field.replace(/^"|"$/g, ""));
}

export function parseCSV(csvText: string): CSVEmployee[] {
    const cleanText = csvText.replace(/^\uFEFF/, "");
    const lines = cleanText
        .split(/\r?\n/)
        .map((line, index) => ({
            text: line.trim(),
            sourceRow: index + 1,
        }))
        .filter((line) => line.text.length > 0);

    if (lines.length < 2) {
        throw new Error("ไฟล์ CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว");
    }

    const headers = parseCSVLine(lines[0].text).map((header) =>
        header.toLowerCase().trim(),
    );
    const fieldMapping: Record<number, keyof CSVEmployee> = {};

    headers.forEach((header, index) => {
        const mappedField = CSV_HEADER_MAPPINGS[header];
        if (mappedField) {
            fieldMapping[index] = mappedField;
        }
    });

    const mappedFields = Object.values(fieldMapping);
    const missingFields = CSV_REQUIRED_FIELDS.filter(
        (field) => !mappedFields.includes(field),
    );

    if (missingFields.length > 0) {
        throw new Error(
            `ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.join(
                ", ",
            )}\n\nพบคอลัมน์: ${headers.join(
                ", ",
            )}\n\nคอลัมน์ที่รองรับ: ${Object.keys(CSV_HEADER_MAPPINGS).join(
                ", ",
            )}`,
        );
    }

    const employees: CSVEmployee[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i].text);
        const employee: CSVEmployee = {
            sourceRow: lines[i].sourceRow,
            firstName: "",
            lastName: "",
            position: "",
            department: "",
        };

        values.forEach((value, index) => {
            const field = fieldMapping[index];
            if (field && value && value.trim() !== "") {
                (employee as unknown as Record<string, string | number | undefined>)[field] =
                    value.trim();
            }
        });

        employees.push(employee);
    }

    return employees;
}

export function generateSampleCSV(): string {
    const sampleData = `ลำดับ,ชื่อ,นามสกุล,ชื่อเล่น,ตำแหน่ง,สังกัด,แผนก,อีเมล,เบอร์โทร,สถานะ
1,สมชาย,ใจดี,ชาย,ผู้จัดการ,สำนักงานใหญ่,บริหาร,somchai@thainhf.org,081-234-5678,ปกติ
2,สมหญิง,รักงาน,หญิง,อาจารย์,คณะวิทยาศาสตร์,วิชาการ,,082-345-6789,ปกติ
3,เจษฎา,รักเรียน,เจ,ครู,โรงเรียนประถม,ADMIN,,081-111-2222,ปกติ`;

    return "\uFEFF" + sampleData;
}

export function downloadSampleCSV(
    filename: string = "ตัวอย่างข้อมูลพนักงาน.csv",
): void {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
}
