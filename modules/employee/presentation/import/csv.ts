import { parseEmployeeImportStatus } from "../../domain/import-status";
import {
    getEmployeeImportDepartmentCode,
    normalizeEmployeeImportEmail,
    normalizeEmployeeImportName,
} from "../../domain/import-values";
import type { EmployeeStatusValue } from "../../domain/lifecycle";
import type {
    CSVEmployee,
    CSVEmployeeRowValidation,
    ImportError,
} from "./types";

type CSVEmployeeField = Exclude<keyof CSVEmployee, "sourceRow">;

export const CSV_HEADER_MAPPINGS: Record<string, CSVEmployeeField> = {
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

export const CSV_REQUIRED_FIELDS: CSVEmployeeField[] = [
    "firstName",
    "lastName",
    "position",
    "department",
];

export function parseEmployeeStatus(raw: string | undefined): EmployeeStatusValue {
    return parseEmployeeImportStatus(raw);
}

interface CSVRecord {
    fields: string[];
    sourceRow: number;
}

function parseCSVRecords(csvText: string): CSVRecord[] {
    const text = csvText.replace(/^\uFEFF/, "");
    const records: CSVRecord[] = [];
    let fields: string[] = [];
    let field = "";
    let inQuotes = false;
    let afterQuote = false;
    let recordHasContent = false;
    let lineNumber = 1;
    let recordStartLine = 1;

    const pushField = (): void => {
        fields.push(field.trim());
        field = "";
        afterQuote = false;
    };

    const pushRecord = (): void => {
        pushField();
        if (recordHasContent || fields.length > 1) {
            records.push({ fields, sourceRow: recordStartLine });
        }
        fields = [];
        recordHasContent = false;
    };

    const advanceLineEnding = (index: number): number => {
        if (text[index] === "\r" && text[index + 1] === "\n") return index + 1;
        return index;
    };

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const isLineEnding = character === "\r" || character === "\n";

        if (inQuotes) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                    afterQuote = true;
                }
            } else if (isLineEnding) {
                field += "\n";
                index = advanceLineEnding(index);
                lineNumber += 1;
            } else {
                field += character;
            }
            continue;
        }

        if (isLineEnding) {
            pushRecord();
            index = advanceLineEnding(index);
            lineNumber += 1;
            recordStartLine = lineNumber;
            continue;
        }

        if (afterQuote) {
            if (character === ",") {
                pushField();
                recordHasContent = true;
                continue;
            }
            if (character === " " || character === "\t") continue;
            throw new Error(`รูปแบบ CSV ไม่ถูกต้องที่แถว ${lineNumber}: มีข้อมูลต่อท้ายเครื่องหมายคำพูด`);
        }

        if (character === ",") {
            pushField();
            recordHasContent = true;
            continue;
        }

        if (character === '"') {
            if (field.trim() !== "") {
                throw new Error(`รูปแบบ CSV ไม่ถูกต้องที่แถว ${lineNumber}: เครื่องหมายคำพูดอยู่ในตำแหน่งที่ไม่ถูกต้อง`);
            }
            field = "";
            inQuotes = true;
            recordHasContent = true;
            continue;
        }

        field += character;
        if (character.trim() !== "") recordHasContent = true;
    }

    if (inQuotes) {
        throw new Error(`รูปแบบ CSV ไม่ถูกต้องที่แถว ${recordStartLine}: เครื่องหมายคำพูดไม่ครบคู่`);
    }
    if (recordHasContent || fields.length > 0 || field.trim() !== "") pushRecord();

    return records;
}

export function parseCSVLine(line: string): string[] {
    return parseCSVRecords(line)[0]?.fields ?? [""];
}

const REQUIRED_FIELD_LABELS: Readonly<Record<string, string>> = {
    firstName: "ชื่อ",
    lastName: "นามสกุล",
    position: "ตำแหน่ง",
    department: "แผนก",
};

export function parseCSV(csvText: string): CSVEmployee[] {
    const records = parseCSVRecords(csvText);
    if (records.length < 2) {
        throw new Error("ไฟล์ CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว");
    }

    const headerRecord = records[0];
    const headers = headerRecord.fields.map((header) =>
        header.toLowerCase().trim(),
    );
    const fieldMapping: Array<CSVEmployeeField | undefined> = [];
    const mappedHeaderFields = new Set<CSVEmployeeField>();

    headers.forEach((header, index) => {
        const mappedField = CSV_HEADER_MAPPINGS[header];
        if (mappedField) {
            if (mappedHeaderFields.has(mappedField)) {
                throw new Error(`หัวตาราง CSV มีคอลัมน์ "${header}" ซ้ำกัน`);
            }
            mappedHeaderFields.add(mappedField);
            fieldMapping[index] = mappedField;
        }
    });

    const missingFields = CSV_REQUIRED_FIELDS.filter(
        (field) => !mappedHeaderFields.has(field),
    );

    if (missingFields.length > 0) {
        throw new Error(
            `ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.map((field) => REQUIRED_FIELD_LABELS[field]).join(
                ", ",
            )}\n\nพบคอลัมน์: ${headers.join(
                ", ",
            )}\n\nคอลัมน์ที่รองรับ: ${Object.keys(CSV_HEADER_MAPPINGS).join(
                ", ",
            )}`,
        );
    }

    const employees: CSVEmployee[] = [];
    for (const record of records.slice(1)) {
        const values = record.fields;
        if (values.length !== headers.length) {
            throw new Error(
                `รูปแบบ CSV ไม่ถูกต้องที่แถว ${record.sourceRow}: มี ${values.length} คอลัมน์ แต่หัวตารางมี ${headers.length} คอลัมน์`,
            );
        }
        const employee: CSVEmployee = {
            sourceRow: record.sourceRow,
            firstName: "",
            lastName: "",
            position: "",
            department: "",
        };

        values.forEach((value, index) => {
            const field = fieldMapping[index];
            if (field && value !== "") {
                Object.assign(employee, { [field]: value });
            }
        });

        employees.push(employee);
    }

    return employees;
}

export function validateEmployeeImportRows(
    employees: readonly CSVEmployee[],
): CSVEmployeeRowValidation[] {
    const validations = employees.map((employee, index): CSVEmployeeRowValidation => ({
        index,
        sourceRow: employee.sourceRow ?? index + 2,
        issues: [],
    }));
    const emailRows = new Map<string, number[]>();
    const nameRows = new Map<string, number[]>();

    const addIssue = (
        index: number,
        field: CSVEmployeeField,
        message: string,
    ): void => {
        validations[index]?.issues.push({ field, message });
    };

    employees.forEach((employee, index) => {
        const requiredFields = [
            ["firstName", employee.firstName, "ชื่อ"],
            ["lastName", employee.lastName, "นามสกุล"],
            ["position", employee.position, "ตำแหน่ง"],
            ["department", employee.department, "แผนก"],
        ] as const;

        for (const [field, value, label] of requiredFields) {
            if (value.trim() === "") {
                addIssue(index, field, `กรุณากรอก${label}`);
            }
        }

        try {
            const email = normalizeEmployeeImportEmail(employee.email);
            if (email) {
                const rows = emailRows.get(email) ?? [];
                rows.push(index);
                emailRows.set(email, rows);
            }
        } catch (validationError) {
            addIssue(
                index,
                "email",
                validationError instanceof Error ? validationError.message : "อีเมลไม่ถูกต้อง",
            );
        }

        if (employee.department.trim() !== ""
            && !getEmployeeImportDepartmentCode(employee.department)) {
            addIssue(
                index,
                "department",
                "รหัสแผนกไม่ถูกต้อง ใช้ได้เฉพาะ ADMIN (บริหาร) หรือ ACADEMIC (วิชาการ)",
            );
        }

        try {
            parseEmployeeImportStatus(employee.status);
        } catch (validationError) {
            addIssue(
                index,
                "status",
                (validationError instanceof Error ? validationError.message : "สถานะพนักงานไม่ถูกต้อง")
                    + " ใช้ ACTIVE (ปกติ), INACTIVE (ลาออก) หรือ SUSPENDED (ถูกระงับ)",
            );
        }

        if (employee.firstName.trim() !== "" && employee.lastName.trim() !== "") {
            const name = normalizeEmployeeImportName(employee.firstName, employee.lastName);
            const rows = nameRows.get(name) ?? [];
            rows.push(index);
            nameRows.set(name, rows);
        }
    });

    const addDuplicateIssues = (
        duplicateRows: ReadonlyMap<string, number[]>,
        field: "email" | "firstName",
        describe: (rowNumbers: number[]) => string,
    ): void => {
        for (const indexes of duplicateRows.values()) {
            if (indexes.length < 2) continue;
            for (const index of indexes) {
                const otherRows = indexes
                    .filter((otherIndex) => otherIndex !== index)
                    .map((otherIndex) => validations[otherIndex]?.sourceRow ?? otherIndex + 2);
                addIssue(index, field, describe(otherRows));
            }
        }
    };

    addDuplicateIssues(emailRows, "email", (rows) => `อีเมลซ้ำกับแถว ${rows.join(", ")}`);
    addDuplicateIssues(nameRows, "firstName", (rows) => `ชื่อและนามสกุลซ้ำกับแถว ${rows.join(", ")}`);

    return validations.filter((validation) => validation.issues.length > 0);
}

function quoteCSVCell(value: string): string {
    const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
}

export function generateFailedRowsCSV(errors: readonly ImportError[]): string {
    const rows = [
        ["แถวต้นฉบับ CSV", "ชื่อ", "นามสกุล", "อีเมล", "เบอร์โทร", "ตำแหน่ง", "แผนก", "สังกัด", "ชื่อเล่น", "สถานะ", "เหตุผล"],
        ...errors.map((error) => [
            String(error.row),
            error.data.firstName ?? "",
            error.data.lastName ?? "",
            error.data.email ?? "",
            error.data.phone ?? "",
            error.data.position ?? "",
            error.data.department ?? "",
            error.data.affiliation ?? "",
            error.data.nickname ?? "",
            error.data.status ?? "",
            error.error,
        ]),
    ];

    return `\uFEFF${rows.map((row) => row.map(quoteCSVCell).join(",")).join("\r\n")}`;
}

export function downloadFailedRowsCSV(errors: readonly ImportError[]): void {
    const blob = new Blob([generateFailedRowsCSV(errors)], {
        type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "รายการพนักงานที่นำเข้าไม่สำเร็จ.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
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
