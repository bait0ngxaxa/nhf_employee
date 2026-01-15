/**
 * Audit Log Action Labels - Thai translations for audit actions
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
    LOGIN_SUCCESS: "เข้าสู่ระบบสำเร็จ",
    LOGIN_FAILED: "เข้าสู่ระบบล้มเหลว",
    LOGOUT: "ออกจากระบบ",
    PASSWORD_CHANGE: "เปลี่ยนรหัสผ่าน",
    PASSWORD_RESET: "รีเซ็ตรหัสผ่าน",
    EMPLOYEE_CREATE: "สร้างพนักงาน",
    EMPLOYEE_UPDATE: "แก้ไขพนักงาน",
    EMPLOYEE_DELETE: "ลบพนักงาน",
    EMPLOYEE_STATUS_CHANGE: "เปลี่ยนสถานะพนักงาน",
    EMPLOYEE_IMPORT: "นำเข้าพนักงาน",
    TICKET_CREATE: "สร้าง Ticket",
    TICKET_UPDATE: "แก้ไข Ticket",
    TICKET_STATUS_CHANGE: "เปลี่ยนสถานะ Ticket",
    TICKET_ASSIGN: "มอบหมาย Ticket",
    TICKET_COMMENT: "คอมเมนต์ Ticket",
    USER_CREATE: "สร้างผู้ใช้",
    USER_UPDATE: "แก้ไขผู้ใช้",
    USER_DELETE: "ลบผู้ใช้",
    USER_ROLE_CHANGE: "เปลี่ยนสิทธิ์ผู้ใช้",
    SETTINGS_UPDATE: "อัปเดตการตั้งค่า",
    DATA_EXPORT: "ส่งออกข้อมูล",
    EMAIL_REQUEST: "ขออีเมลพนักงานใหม่",
};

/**
 * Audit Action Filter Options for dropdowns
 */
export const AUDIT_ACTION_FILTER_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "LOGIN_SUCCESS", label: "เข้าสู่ระบบสำเร็จ" },
    { value: "LOGIN_FAILED", label: "เข้าสู่ระบบล้มเหลว" },
    { value: "EMPLOYEE_CREATE", label: "สร้างพนักงาน" },
    { value: "EMPLOYEE_UPDATE", label: "แก้ไขพนักงาน" },
    { value: "EMPLOYEE_DELETE", label: "ลบพนักงาน" },
    { value: "TICKET_CREATE", label: "สร้าง Ticket" },
    { value: "USER_CREATE", label: "สร้างผู้ใช้" },
    { value: "DATA_EXPORT", label: "ส่งออกข้อมูล" },
    { value: "EMAIL_REQUEST", label: "ขออีเมลพนักงานใหม่" },
];

/**
 * Audit Entity Type Filter Options
 */
export const AUDIT_ENTITY_TYPE_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "User", label: "User" },
    { value: "Employee", label: "Employee" },
    { value: "Ticket", label: "Ticket" },
];

/**
 * Get badge color based on action type
 */
export const getAuditActionBadgeColor = (action: string): string => {
    if (action.includes("DELETE")) return "bg-red-100 text-red-700";
    if (action.includes("CREATE")) return "bg-green-100 text-green-700";
    if (action.includes("UPDATE") || action.includes("CHANGE"))
        return "bg-blue-100 text-blue-700";
    if (action.includes("LOGIN_SUCCESS"))
        return "bg-emerald-100 text-emerald-700";
    if (action.includes("LOGIN_FAILED")) return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-700";
};
