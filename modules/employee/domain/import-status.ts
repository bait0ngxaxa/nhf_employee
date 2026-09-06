import type { EmployeeStatusValue } from "./lifecycle";

const STATUS_INPUT_MAP: Readonly<Record<string, EmployeeStatusValue>> = {
    active: "ACTIVE",
    "ทำงานอยู่": "ACTIVE",
    "ปกติ": "ACTIVE",
    inactive: "INACTIVE",
    "ไม่ทำงาน": "INACTIVE",
    "ลาออก": "INACTIVE",
    suspended: "SUSPENDED",
    "ถูกระงับ": "SUSPENDED",
};

export function parseEmployeeImportStatus(raw: string | undefined): EmployeeStatusValue {
    if (!raw || raw.trim() === "-" || raw.trim() === "") return "ACTIVE";
    const status = STATUS_INPUT_MAP[raw.trim().toLowerCase()];
    if (!status) throw new Error(`สถานะพนักงาน "${raw.trim()}" ไม่ถูกต้อง`);
    return status;
}
