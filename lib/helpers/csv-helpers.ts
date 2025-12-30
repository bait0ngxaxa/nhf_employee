import { CSVEmployee } from "@/types/employees";

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
};

export const CSV_REQUIRED_FIELDS: (keyof CSVEmployee)[] = [
    "firstName",
    "lastName",
    "position",
    "department",
];

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
        header.toLowerCase().trim()
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
        (field) => !mappedFields.includes(field)
    );

    if (missingFields.length > 0) {
        throw new Error(
            `ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.join(
                ", "
            )}\n\nพบคอลัมน์: ${headers.join(
                ", "
            )}\n\nคอลัมน์ที่รองรับ: ${Object.keys(CSV_HEADER_MAPPINGS).join(
                ", "
            )}`
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
    const sampleData = `ชื่อ,นามสกุล,อีเมล,เบอร์โทรศัพท์,ตำแหน่ง,แผนก,สังกัด,ชื่อเล่น
สมชาย,ใจดี,somchai@company.com,081-234-5678,ผู้จัดการ,ADMIN,สำนักงานใหญ่,ชาย
สมหญิง,รักงาน,,082-345-6789,อาจารย์,ACADEMIC,คณะวิทยาศาสตร์,หญิง
เจษฎา,รักเรียน,,081-111-2222,ครู,ADMIN,โรงเรียนประถม,เจ`;

    // Add UTF-8 BOM for proper Thai character display
    return "\uFEFF" + sampleData;
}

/**
 * Download sample CSV file
 */
export function downloadSampleCSV(
    filename: string = "ตัวอย่างข้อมูลพนักงาน.csv"
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
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
