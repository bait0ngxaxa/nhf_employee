import { getAuditActionLabel } from "@/constants/audit";
import {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
    type LeaveTypeValue,
} from "@/lib/services/leave/notification-format";
import type { LeavePeriodValue } from "@/lib/services/leave/utils";

export interface AuditLogDisplayInput {
    action: string;
    entityType: string;
    entityId: number | null;
    details: Record<string, unknown> | null;
}

export interface AuditLogDisplay {
    entityLabel: string;
    entityReference: string;
    summary: string;
    changedFields: string[];
}

const ENTITY_LABELS: Record<string, string> = {
    User: "ผู้ใช้ระบบ",
    Employee: "พนักงาน",
    Ticket: "งานบริการ IT",
    Stock: "สต็อก",
    StockCategory: "หมวดหมู่วัสดุ",
    StockItem: "วัสดุ",
    StockRequest: "คำขอเบิกวัสดุ",
    LeaveRequest: "คำขอลา",
    Leave: "คำขอลา",
};

const FIELD_LABELS: Record<string, string> = {
    category: "หมวดหมู่",
    departmentId: "ฝ่าย/แผนก",
    durationDays: "จำนวนวันลา",
    email: "อีเมล",
    firstName: "ชื่อ",
    isActive: "สถานะใช้งาน",
    lastName: "นามสกุล",
    minStock: "จำนวนขั้นต่ำ",
    name: "ชื่อ",
    newMinStock: "จำนวนขั้นต่ำใหม่",
    newQty: "จำนวนใหม่",
    period: "ช่วงเวลา",
    position: "ตำแหน่ง",
    previousMinStock: "จำนวนขั้นต่ำเดิม",
    previousQty: "จำนวนเดิม",
    priority: "ความสำคัญ",
    projectCode: "รหัสโครงการ",
    quantity: "จำนวนที่ปรับ",
    reason: "เหตุผล",
    sku: "รหัสวัสดุ",
    status: "สถานะ",
    title: "หัวข้อ",
    type: "ประเภท",
};

const SENSITIVE_KEY_PARTS = ["password", "token", "session", "cookie", "secret"];

const VALUE_LABELS: Record<string, string> = {
    ADJUST: "ปรับยอด",
    APPROVED: "จ่ายแล้ว",
    balances: "รายงานยอดคงเหลือวัสดุ",
    CANCELLED: "ยกเลิก",
    IN: "เพิ่มสต็อก",
    ISSUED: "จ่ายแล้ว",
    OUT: "ลดสต็อก",
    PENDING: "รอจ่าย",
    PENDING_ISSUE: "รอจ่าย",
    REJECTED: "ไม่อนุมัติ",
    REJECTED_LEGACY: "ไม่อนุมัติ",
    xlsx: "ไฟล์ Excel",
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSection(
    details: Record<string, unknown> | null,
    key: "before" | "after" | "metadata",
): Record<string, unknown> {
    const section = details?.[key];
    return isRecord(section) ? section : {};
}

function getText(source: Record<string, unknown>, key: string): string | null {
    const value = source[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(source: Record<string, unknown>, key: string): number | null {
    const value = source[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function formatValue(value: unknown): string {
    if (typeof value === "boolean") return value ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (typeof value === "number") return value.toLocaleString("th-TH");
    if (typeof value === "string" && value.trim()) {
        return VALUE_LABELS[value.trim()] ?? value.trim();
    }
    if (value === null) return "ว่าง";
    return "-";
}

function getDisplayName(source: Record<string, unknown>): string | null {
    const fullName = [getText(source, "firstName"), getText(source, "lastName")]
        .filter(Boolean)
        .join(" ");
    return fullName || getText(source, "name") || getText(source, "title")
        || getText(source, "email") || getText(source, "sku");
}

function getChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
): string[] {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].filter((key) => {
        if (isSensitiveKey(key)) return false;
        if (!(key in after)) return false;
        return JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    }).map((key) => {
        const label = FIELD_LABELS[key] ?? key;
        return `${label}: ${formatValue(before[key])} → ${formatValue(after[key])}`;
    });
}

function formatLeaveSummary(metadata: Record<string, unknown>): string | null {
    const leaveType = getText(metadata, "leaveType");
    const period = getText(metadata, "period");
    const startDate = getText(metadata, "startDate");
    const endDate = getText(metadata, "endDate");
    const durationDays = getNumber(metadata, "durationDays");
    if (
        !isLeaveType(leaveType)
        || !isLeavePeriod(period)
        || !startDate
        || !endDate
        || durationDays === null
    ) {
        return null;
    }

    const typeLabel = getLeaveTypeLabel(leaveType);
    const dateRange = formatLeaveDateRange(startDate, endDate);
    const duration = formatLeaveDurationDays(durationDays);
    const periodLabel = getLeavePeriodLabel(period);
    return `${typeLabel} ${dateRange} จำนวน ${duration} วัน (${periodLabel})`;
}

function isLeaveType(value: string | null): value is LeaveTypeValue {
    return value === "SICK" || value === "PERSONAL" || value === "VACATION";
}

function isLeavePeriod(value: string | null): value is LeavePeriodValue {
    return value === "FULL_DAY" || value === "MORNING" || value === "AFTERNOON";
}

function formatStockAdjustment(after: Record<string, unknown>): string | null {
    const previousQty = getNumber(after, "previousQty");
    const newQty = getNumber(after, "newQty");
    const quantity = getNumber(after, "quantity");
    if (previousQty === null || newQty === null || quantity === null) return null;

    const typeLabel = quantity >= 0 ? "เพิ่ม" : "ลด";
    const itemName = getText(after, "name");
    const target = itemName ? ` ${itemName}` : "";
    return `ปรับยอดสต็อก${target}: ${typeLabel} ${Math.abs(quantity).toLocaleString("th-TH")} จาก ${previousQty.toLocaleString("th-TH")} เป็น ${newQty.toLocaleString("th-TH")}`;
}

function formatDataExportSummary(
    entityType: string,
    metadata: Record<string, unknown>,
): string | null {
    const recordCount = getNumber(metadata, "recordCount");
    const filters = metadata.filters;
    const reportType = isRecord(filters) ? getText(filters, "reportType") : null;
    const year = isRecord(filters) ? getNumber(filters, "year") : null;
    const countText = recordCount === null
        ? ""
        : ` ${recordCount.toLocaleString("th-TH")} รายการ`;

    if (entityType === "StockItem" || reportType === "balances") {
        return `ส่งออกรายงานยอดคงเหลือวัสดุ${countText}`;
    }
    if (entityType === "StockRequest") {
        const yearText = year === null ? "" : ` ปี ${year.toLocaleString("th-TH", { useGrouping: false })}`;
        return `ส่งออกรายงานเบิกวัสดุ${yearText}${countText}`;
    }

    return null;
}

function buildActionSummary(input: AuditLogDisplayInput): string {
    const before = getSection(input.details, "before");
    const after = getSection(input.details, "after");
    const metadata = getSection(input.details, "metadata");
    const name = getDisplayName(after) ?? getDisplayName(before);
    const changes = getChangedFields(before, after);

    if (input.action === "STOCK_ADJUST") return formatStockAdjustment(after) ?? "ปรับยอดสต็อก";
    if (input.action === "DATA_EXPORT") {
        return formatDataExportSummary(input.entityType, metadata)
            ?? getAuditActionLabel(input.action);
    }
    if (input.action === "LEAVE_REQUEST_CREATE") return formatLeaveSummary(metadata) ?? "ยื่นคำขอลา";
    if (input.action.includes("UPDATE") || input.action.includes("STATUS_CHANGE")) {
        return changes.length > 0 ? `แก้ไข${getEntityLabel(input.entityType)}: ${changes.join(", ")}` : getAuditActionLabel(input.action);
    }
    if (input.action.includes("CREATE")) {
        return name ? `${getAuditActionLabel(input.action)}: ${name}` : getAuditActionLabel(input.action);
    }
    if (input.action.includes("DELETE") || input.action.includes("CANCEL")) {
        return name ? `${getAuditActionLabel(input.action)}: ${name}` : getAuditActionLabel(input.action);
    }
    return name ? `${getAuditActionLabel(input.action)}: ${name}` : getAuditActionLabel(input.action);
}

export function getEntityLabel(entityType: string): string {
    return ENTITY_LABELS[entityType] ?? entityType;
}

export function formatAuditLogDisplay(
    input: AuditLogDisplayInput,
): AuditLogDisplay {
    const entityLabel = getEntityLabel(input.entityType);
    const entityReference = input.entityId ? `${entityLabel} #${input.entityId}` : entityLabel;
    const before = getSection(input.details, "before");
    const after = getSection(input.details, "after");

    return {
        entityLabel,
        entityReference,
        summary: buildActionSummary(input),
        changedFields: getChangedFields(before, after),
    };
}
