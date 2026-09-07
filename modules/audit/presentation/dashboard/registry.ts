import type { AuditAction } from "@prisma/client";

interface AuditActionMeta {
    label: string;
    badgeClassName: string;
}

const AUDIT_BADGE_TONES = {
    neutral: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-400/30",
    success: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30",
    error: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-400/30",
    signOut: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-400/30",
    security: "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-400/30",
    credential: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-400/30",
    create: "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-400/30",
    update: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/30",
    remove: "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/30",
    stateChange: "bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-400/30",
    dataImport: "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-400/30",
    dataExport: "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-400/30",
    approved: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-400/30",
    cancelled: "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/30",
    warning: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/30",
    reassigned: "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-400/30",
} as const;

const DEFAULT_AUDIT_ACTION_META: AuditActionMeta = {
    label: "การดำเนินการอื่น ๆ",
    badgeClassName: AUDIT_BADGE_TONES.neutral,
};

export const AUDIT_ACTION_META = {
    LOGIN_SUCCESS: {
        label: "เข้าสู่ระบบสำเร็จ",
        badgeClassName: AUDIT_BADGE_TONES.success,
    },
    LOGIN_FAILED: {
        label: "เข้าสู่ระบบล้มเหลว",
        badgeClassName: AUDIT_BADGE_TONES.error,
    },
    LOGOUT: {
        label: "ออกจากระบบ",
        badgeClassName: AUDIT_BADGE_TONES.signOut,
    },
    PASSWORD_CHANGE: {
        label: "เปลี่ยนรหัสผ่าน",
        badgeClassName: AUDIT_BADGE_TONES.security,
    },
    PASSWORD_RESET: {
        label: "รีเซ็ตรหัสผ่าน",
        badgeClassName: AUDIT_BADGE_TONES.credential,
    },
    EMPLOYEE_CREATE: {
        label: "สร้างพนักงาน",
        badgeClassName: AUDIT_BADGE_TONES.create,
    },
    EMPLOYEE_UPDATE: {
        label: "แก้ไขพนักงาน",
        badgeClassName: AUDIT_BADGE_TONES.update,
    },
    EMPLOYEE_DELETE: {
        label: "ลบพนักงาน",
        badgeClassName: AUDIT_BADGE_TONES.remove,
    },
    EMPLOYEE_STATUS_CHANGE: {
        label: "เปลี่ยนสถานะพนักงาน",
        badgeClassName: AUDIT_BADGE_TONES.stateChange,
    },
    EMPLOYEE_IMPORT: {
        label: "นำเข้าพนักงาน",
        badgeClassName: AUDIT_BADGE_TONES.dataImport,
    },
    USER_CREATE: {
        label: "สร้างผู้ใช้",
        badgeClassName: AUDIT_BADGE_TONES.success,
    },
    USER_UPDATE: {
        label: "แก้ไขผู้ใช้",
        badgeClassName: AUDIT_BADGE_TONES.update,
    },
    USER_DELETE: {
        label: "ลบผู้ใช้",
        badgeClassName: AUDIT_BADGE_TONES.remove,
    },
    USER_ROLE_CHANGE: {
        label: "เปลี่ยนสิทธิ์ผู้ใช้",
        badgeClassName: AUDIT_BADGE_TONES.security,
    },
    SETTINGS_UPDATE: {
        label: "อัปเดตการตั้งค่า",
        badgeClassName: AUDIT_BADGE_TONES.stateChange,
    },
    DATA_EXPORT: {
        label: "ส่งออกข้อมูล",
        badgeClassName: AUDIT_BADGE_TONES.dataExport,
    },
    EMAIL_REQUEST: {
        label: "ส่งคำร้องพนักงานใหม่",
        badgeClassName: AUDIT_BADGE_TONES.dataImport,
    },
    LEAVE_REQUEST_CREATE: {
        label: "ยื่นคำขอลา",
        badgeClassName: AUDIT_BADGE_TONES.signOut,
    },
    LEAVE_REQUEST_APPROVE: {
        label: "อนุมัติคำขอลา",
        badgeClassName: AUDIT_BADGE_TONES.approved,
    },
    LEAVE_REQUEST_REJECT: {
        label: "ไม่อนุมัติคำขอลา",
        badgeClassName: AUDIT_BADGE_TONES.error,
    },
    LEAVE_REQUEST_CANCEL: {
        label: "ยกเลิกคำขอลา",
        badgeClassName: AUDIT_BADGE_TONES.cancelled,
    },
    LEAVE_REQUEST_CANCELLATION_REQUEST: {
        label: "ขอยกเลิกวันลาที่อนุมัติแล้ว",
        badgeClassName: AUDIT_BADGE_TONES.warning,
    },
    LEAVE_REQUEST_CANCELLATION_CONFIRM: {
        label: "ยืนยันยกเลิกวันลาที่อนุมัติแล้ว",
        badgeClassName: AUDIT_BADGE_TONES.cancelled,
    },
    LEAVE_REQUEST_NOT_TAKEN_REQUEST: {
        label: "แจ้งไม่ได้ใช้วันลา",
        badgeClassName: AUDIT_BADGE_TONES.signOut,
    },
    LEAVE_REQUEST_NOT_TAKEN_CONFIRM: {
        label: "ยืนยันไม่ได้ใช้วันลา",
        badgeClassName: AUDIT_BADGE_TONES.stateChange,
    },
    STOCK_ITEM_CREATE: {
        label: "สร้างรายการสต็อก",
        badgeClassName: AUDIT_BADGE_TONES.success,
    },
    STOCK_ITEM_UPDATE: {
        label: "แก้ไขรายการสต็อก",
        badgeClassName: AUDIT_BADGE_TONES.update,
    },
    STOCK_ITEM_DELETE: {
        label: "ลบรายการสต็อก",
        badgeClassName: AUDIT_BADGE_TONES.remove,
    },
    STOCK_ADJUST: {
        label: "ปรับยอดสต็อก",
        badgeClassName: AUDIT_BADGE_TONES.warning,
    },
    STOCK_CATEGORY_CREATE: {
        label: "สร้างหมวดหมู่สต็อก",
        badgeClassName: AUDIT_BADGE_TONES.create,
    },
    STOCK_CATEGORY_DELETE: {
        label: "ลบหมวดหมู่สต็อก",
        badgeClassName: AUDIT_BADGE_TONES.remove,
    },
    STOCK_REQUEST_CREATE: {
        label: "สร้างคำขอเบิกวัสดุ",
        badgeClassName: AUDIT_BADGE_TONES.cancelled,
    },
    STOCK_REQUEST_ISSUE: {
        label: "จ่ายคำขอเบิกวัสดุ",
        badgeClassName: AUDIT_BADGE_TONES.approved,
    },
    STOCK_REQUEST_CANCEL: {
        label: "ยกเลิกคำขอเบิกวัสดุ",
        badgeClassName: AUDIT_BADGE_TONES.error,
    },
    ROUTINE_TASK_CREATE: {
        label: "สร้างแม่แบบงานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.success,
    },
    ROUTINE_TASK_UPDATE: {
        label: "แก้ไขแม่แบบงานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.update,
    },
    ROUTINE_TASK_DEACTIVATE: {
        label: "ปิดใช้งานแม่แบบงานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.warning,
    },
    ROUTINE_TASK_DELETE: {
        label: "ลบแม่แบบงานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.remove,
    },
    ROUTINE_OCCURRENCE_REASSIGN: {
        label: "เปลี่ยนผู้รับผิดชอบรอบงาน",
        badgeClassName: AUDIT_BADGE_TONES.reassigned,
    },
    ROUTINE_OCCURRENCE_DUE_DATE_CHANGE: {
        label: "เปลี่ยนวันกำหนดรอบงาน",
        badgeClassName: AUDIT_BADGE_TONES.stateChange,
    },
    ROUTINE_IMPORT_UPLOAD: {
        label: "อัปโหลดไฟล์งานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.signOut,
    },
    ROUTINE_IMPORT_ROW_UPDATE: {
        label: "แก้ไขแถวนำเข้างานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.update,
    },
    ROUTINE_IMPORT_APPLY: {
        label: "นำเข้างานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.approved,
    },
    ROUTINE_IMPORT_CANCEL: {
        label: "ยกเลิกการนำเข้างานประจำ",
        badgeClassName: AUDIT_BADGE_TONES.cancelled,
    },
} as const satisfies Partial<Record<AuditAction, AuditActionMeta>>;

export const AUDIT_ACTION_LABELS = Object.fromEntries(
    Object.entries(AUDIT_ACTION_META).map(([action, metadata]) => [
        action,
        metadata.label,
    ]),
) as Partial<Record<AuditAction, string>>;

export const AUDIT_ACTION_FILTER_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    ...Object.entries(AUDIT_ACTION_META).map(([action, metadata]) => ({
        value: action,
        label: metadata.label,
    })),
];

export const AUDIT_ENTITY_LABELS = {
    User: "ผู้ใช้ระบบ",
    Employee: "พนักงาน",
    EmployeeApprover: "ผู้อนุมัติการลา",
    EmailRequest: "คำร้องพนักงานใหม่",
    Stock: "สต็อก",
    StockItem: "วัสดุ",
    StockVariant: "รายการย่อยวัสดุ",
    StockAdjustment: "รายการปรับยอดสต็อก",
    StockRequest: "คำขอเบิกวัสดุ",
    StockCategory: "หมวดหมู่วัสดุ",
    LeaveRequest: "คำขอลา",
    Leave: "คำขอลา",
    RoutineTask: "แม่แบบงานประจำ",
    RoutineOccurrence: "รอบงานประจำ",
    RoutineImportBatch: "ชุดนำเข้างานประจำ",
    RoutineImportRow: "แถวนำเข้างานประจำ",
} as const satisfies Record<string, string>;

export const AUDIT_ENTITY_TYPE_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    ...Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => ({
        value,
        label,
    })),
];

export function getAuditActionLabel(action: string): string {
    return (AUDIT_ACTION_META as Partial<Record<string, AuditActionMeta>>)[action]?.label
        ?? DEFAULT_AUDIT_ACTION_META.label;
}

export function getAuditActionBadgeClassName(action: string): string {
    return (AUDIT_ACTION_META as Partial<Record<string, AuditActionMeta>>)[action]?.badgeClassName
        ?? DEFAULT_AUDIT_ACTION_META.badgeClassName;
}

export function getAuditActionBadgeColor(action: string): string {
    return getAuditActionBadgeClassName(action);
}
