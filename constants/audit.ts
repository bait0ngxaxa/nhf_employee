interface AuditActionMeta {
    label: string;
    badgeClassName: string;
}

const DEFAULT_AUDIT_ACTION_META: AuditActionMeta = {
    label: "การดำเนินการอื่น ๆ",
    badgeClassName: "bg-slate-100 text-slate-700 border border-slate-200",
};

export const AUDIT_ACTION_META: Record<string, AuditActionMeta> = {
    LOGIN_SUCCESS: {
        label: "เข้าสู่ระบบสำเร็จ",
        badgeClassName: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    },
    LOGIN_FAILED: {
        label: "เข้าสู่ระบบล้มเหลว",
        badgeClassName: "bg-red-100 text-red-700 border border-red-200",
    },
    LOGOUT: {
        label: "ออกจากระบบ",
        badgeClassName: "bg-sky-100 text-sky-700 border border-sky-200",
    },
    PASSWORD_CHANGE: {
        label: "เปลี่ยนรหัสผ่าน",
        badgeClassName: "bg-violet-100 text-violet-700 border border-violet-200",
    },
    PASSWORD_RESET: {
        label: "รีเซ็ตรหัสผ่าน",
        badgeClassName: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200",
    },
    EMPLOYEE_CREATE: {
        label: "สร้างพนักงาน",
        badgeClassName: "bg-teal-100 text-teal-700 border border-teal-200",
    },
    EMPLOYEE_UPDATE: {
        label: "แก้ไขพนักงาน",
        badgeClassName: "bg-blue-100 text-blue-700 border border-blue-200",
    },
    EMPLOYEE_DELETE: {
        label: "ลบพนักงาน",
        badgeClassName: "bg-rose-100 text-rose-700 border border-rose-200",
    },
    EMPLOYEE_STATUS_CHANGE: {
        label: "เปลี่ยนสถานะพนักงาน",
        badgeClassName: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    },
    EMPLOYEE_IMPORT: {
        label: "นำเข้าพนักงาน",
        badgeClassName: "bg-indigo-100 text-indigo-700 border border-indigo-200",
    },
    TICKET_CREATE: {
        label: "สร้าง Ticket",
        badgeClassName: "bg-lime-100 text-lime-700 border border-lime-200",
    },
    TICKET_UPDATE: {
        label: "แก้ไข Ticket",
        badgeClassName: "bg-blue-100 text-blue-700 border border-blue-200",
    },
    TICKET_STATUS_CHANGE: {
        label: "เปลี่ยนสถานะ Ticket",
        badgeClassName: "bg-amber-100 text-amber-700 border border-amber-200",
    },
    TICKET_ASSIGN: {
        label: "มอบหมาย Ticket",
        badgeClassName: "bg-purple-100 text-purple-700 border border-purple-200",
    },
    TICKET_COMMENT: {
        label: "คอมเมนต์ Ticket",
        badgeClassName: "bg-orange-100 text-orange-700 border border-orange-200",
    },
    USER_CREATE: {
        label: "สร้างผู้ใช้",
        badgeClassName: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    },
    USER_UPDATE: {
        label: "แก้ไขผู้ใช้",
        badgeClassName: "bg-blue-100 text-blue-700 border border-blue-200",
    },
    USER_DELETE: {
        label: "ลบผู้ใช้",
        badgeClassName: "bg-rose-100 text-rose-700 border border-rose-200",
    },
    USER_ROLE_CHANGE: {
        label: "เปลี่ยนสิทธิ์ผู้ใช้",
        badgeClassName: "bg-violet-100 text-violet-700 border border-violet-200",
    },
    SETTINGS_UPDATE: {
        label: "อัปเดตการตั้งค่า",
        badgeClassName: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    },
    DATA_EXPORT: {
        label: "ส่งออกข้อมูล",
        badgeClassName: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    },
    EMAIL_REQUEST: {
        label: "ขออีเมลพนักงานใหม่",
        badgeClassName: "bg-indigo-100 text-indigo-700 border border-indigo-200",
    },
    LEAVE_REQUEST_CREATE: {
        label: "ยื่นคำขอลา",
        badgeClassName: "bg-sky-100 text-sky-700 border border-sky-200",
    },
    LEAVE_REQUEST_APPROVE: {
        label: "อนุมัติคำขอลา",
        badgeClassName: "bg-green-100 text-green-700 border border-green-200",
    },
    LEAVE_REQUEST_REJECT: {
        label: "ไม่อนุมัติคำขอลา",
        badgeClassName: "bg-red-100 text-red-700 border border-red-200",
    },
    LEAVE_REQUEST_CANCEL: {
        label: "ยกเลิกคำขอลา",
        badgeClassName: "bg-orange-100 text-orange-700 border border-orange-200",
    },
    STOCK_ITEM_CREATE: {
        label: "สร้างรายการสต็อก",
        badgeClassName: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    },
    STOCK_ITEM_UPDATE: {
        label: "แก้ไขรายการสต็อก",
        badgeClassName: "bg-blue-100 text-blue-700 border border-blue-200",
    },
    STOCK_ITEM_DELETE: {
        label: "ลบรายการสต็อก",
        badgeClassName: "bg-rose-100 text-rose-700 border border-rose-200",
    },
    STOCK_ADJUST: {
        label: "ปรับยอดสต็อก",
        badgeClassName: "bg-amber-100 text-amber-700 border border-amber-200",
    },
    STOCK_CATEGORY_CREATE: {
        label: "สร้างหมวดหมู่สต็อก",
        badgeClassName: "bg-teal-100 text-teal-700 border border-teal-200",
    },
    STOCK_CATEGORY_DELETE: {
        label: "ลบหมวดหมู่สต็อก",
        badgeClassName: "bg-rose-100 text-rose-700 border border-rose-200",
    },
    STOCK_REQUEST_CREATE: {
        label: "สร้างคำขอเบิกวัสดุ",
        badgeClassName: "bg-orange-100 text-orange-700 border border-orange-200",
    },
    STOCK_REQUEST_ISSUE: {
        label: "จ่ายคำขอเบิกวัสดุ",
        badgeClassName: "bg-green-100 text-green-700 border border-green-200",
    },
    STOCK_REQUEST_CANCEL: {
        label: "ยกเลิกคำขอเบิกวัสดุ",
        badgeClassName: "bg-red-100 text-red-700 border border-red-200",
    },
};

export const AUDIT_ACTION_LABELS: Record<string, string> = Object.entries(
    AUDIT_ACTION_META,
).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value.label;
    return acc;
}, {});

const AUDIT_FILTER_ACTIONS = [
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "EMPLOYEE_CREATE",
    "EMPLOYEE_UPDATE",
    "EMPLOYEE_DELETE",
    "TICKET_CREATE",
    "USER_CREATE",
    "DATA_EXPORT",
    "EMAIL_REQUEST",
    "LEAVE_REQUEST_CREATE",
    "LEAVE_REQUEST_APPROVE",
    "LEAVE_REQUEST_REJECT",
    "LEAVE_REQUEST_CANCEL",
    "STOCK_ITEM_CREATE",
    "STOCK_ITEM_UPDATE",
    "STOCK_ITEM_DELETE",
    "STOCK_ADJUST",
    "STOCK_CATEGORY_CREATE",
    "STOCK_CATEGORY_DELETE",
    "STOCK_REQUEST_CREATE",
    "STOCK_REQUEST_ISSUE",
    "STOCK_REQUEST_CANCEL",
] as const;

export const AUDIT_ACTION_FILTER_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    ...AUDIT_FILTER_ACTIONS.map((action) => ({
        value: action,
        label: AUDIT_ACTION_LABELS[action],
    })),
];

export const AUDIT_ENTITY_TYPE_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "User", label: "User" },
    { value: "Employee", label: "Employee" },
    { value: "Ticket", label: "Ticket" },
    { value: "Stock", label: "Stock" },
];

export function getAuditActionLabel(action: string): string {
    return AUDIT_ACTION_META[action]?.label ?? DEFAULT_AUDIT_ACTION_META.label;
}

export function getAuditActionBadgeClassName(action: string): string {
    return AUDIT_ACTION_META[action]?.badgeClassName
        ?? DEFAULT_AUDIT_ACTION_META.badgeClassName;
}

export function getAuditActionBadgeColor(action: string): string {
    return getAuditActionBadgeClassName(action);
}
