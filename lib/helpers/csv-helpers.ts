import { type CSVEmployee } from "@/types/employees";
import { EmployeeStatus } from "@prisma/client";

// CSV header mapping (support both Thai and English headers)
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

// Maps human-readable status strings (Thai/English) to the Prisma enum value
const STATUS_INPUT_MAP: Record<string, EmployeeStatus> = {
    active: EmployeeStatus.ACTIVE,
    "ทำงานอยู่": EmployeeStatus.ACTIVE,
    "ปกติ": EmployeeStatus.ACTIVE,
    inactive: EmployeeStatus.INACTIVE,
    "ไม่ทำงาน": EmployeeStatus.INACTIVE,
    "ลาออก": EmployeeStatus.INACTIVE,
    suspended: EmployeeStatus.SUSPENDED,
    "ถูกระงับ": EmployeeStatus.SUSPENDED,
};

/**
 * Parse a status string from CSV into the EmployeeStatus enum.
 * Falls back to ACTIVE when the value is absent or unrecognised.
 */
export function parseEmployeeStatus(raw: string | undefined): EmployeeStatus {
    if (!raw || raw.trim() === "-" || raw.trim() === "") {
        return EmployeeStatus.ACTIVE;
    }
    return STATUS_INPUT_MAP[raw.trim().toLowerCase()] ?? EmployeeStatus.ACTIVE;
}

/**
 * Parse a single CSV line, handling quoted fields properly
 */
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
    return result.map((field) => field.replace(/^"|"$/g, "")); // Remove surrounding quotes
}

/**
 * Parse CSV text into array of CSVEmployee objects
 */
export function parseCSV(csvText: string): CSVEmployee[] {
    // Remove BOM if present
    const cleanText = csvText.replace(/^\uFEFF/, "");
    const lines = cleanText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

    if (lines.length < 2) {
        throw new Error("ไฟล์ CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว");
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]).map((header) =>
        header.toLowerCase().trim(),
    );

    // Map headers to our expected fields
    const fieldMapping: Record<number, keyof CSVEmployee> = {};
    headers.forEach((header, index) => {
        const mappedField = CSV_HEADER_MAPPINGS[header];
        if (mappedField) {
            fieldMapping[index] = mappedField;
        }
    });

    // Check if required fields are present
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

    // Parse data rows
    const employees: CSVEmployee[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        const employee: Partial<CSVEmployee> = {};
        values.forEach((value, index) => {
            const field = fieldMapping[index];
            if (field && value && value.trim() !== "") {
                (employee as Record<string, string | undefined>)[field] =
                    value.trim();
            }
        });

        // Validate required fields
        const missing: string[] = [];
        if (!employee.firstName) missing.push("firstName");
        if (!employee.lastName) missing.push("lastName");
        if (!employee.position) missing.push("position");
        if (!employee.department) missing.push("department");

        if (missing.length === 0) {
            employees.push(employee as CSVEmployee);
        }
    }

    return employees;
}

/**
 * Generate sample CSV content for download
 */
export function generateSampleCSV(): string {
    const sampleData = `ลำดับ,ชื่อ,นามสกุล,ชื่อเล่น,ตำแหน่ง,สังกัด,แผนก,อีเมล,เบอร์โทร,สถานะ
1,สมชาย,ใจดี,ชาย,ผู้จัดการ,สำนักงานใหญ่,บริหาร,somchai@company.com,081-234-5678,ปกติ
2,สมหญิง,รักงาน,หญิง,อาจารย์,คณะวิทยาศาสตร์,วิชาการ,,082-345-6789,ปกติ
3,เจษฎา,รักเรียน,เจ,ครู,โรงเรียนประถม,ADMIN,,081-111-2222,ปกติ`;

    // Add UTF-8 BOM for proper Thai character display
    return "\uFEFF" + sampleData;
}

/**
 * Download sample CSV file
 */
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

// ============================================================
// Leave CSV Helpers
// ============================================================

export interface LeaveRequestRow {
    employee: {
        firstName: string;
        lastName: string;
        nickname?: string;
        position: string;
        dept?: { name: string };
    };
    leaveType: string;
    startDate: string;
    endDate: string;
    period: string;
    durationDays: number;
    reason: string;
    status: string;
    createdAt: string;
}

export const LEAVE_TYPE_TH: Record<string, string> = {
    SICK: "ลาป่วย",
    PERSONAL: "ลากิจ",
    VACATION: "ลาพักร้อน",
};

export const LEAVE_PERIOD_TH: Record<string, string> = {
    FULL_DAY: "เต็มวัน",
    MORNING: "ครึ่งวันเช้า",
    AFTERNOON: "ครึ่งวันบ่าย",
};

export const LEAVE_STATUS_TH: Record<string, string> = {
    PENDING: "รออนุมัติ",
    APPROVED: "อนุมัติแล้ว",
    REJECTED: "ไม่อนุมัติ",
    CANCELLED: "ยกเลิก",
};

/**
 * Map a raw LeaveRequest API row to a Thai-labelled CSV row object.
 */
export function mapLeaveRowToCSV(
    r: LeaveRequestRow,
    index: number
): Record<string, string | number> {
    return {
        "ลำดับ": index + 1,
        "ชื่อ-นามสกุล": `${r.employee.firstName} ${r.employee.lastName}${r.employee.nickname ? ` (${r.employee.nickname})` : ""}`,
        "แผนก": r.employee.dept?.name ?? "-",
        "ตำแหน่ง": r.employee.position,
        "ประเภทการลา": LEAVE_TYPE_TH[r.leaveType] ?? r.leaveType,
        "วันที่เริ่ม": new Date(r.startDate).toLocaleDateString("th-TH"),
        "วันที่สิ้นสุด": new Date(r.endDate).toLocaleDateString("th-TH"),
        "ช่วงเวลา": LEAVE_PERIOD_TH[r.period] ?? r.period,
        "จำนวนวัน": r.durationDays,
        "เหตุผล": r.reason,
        "สถานะ": LEAVE_STATUS_TH[r.status] ?? r.status,
        "วันที่ยื่น": new Date(r.createdAt).toLocaleDateString("th-TH"),
    };
}
