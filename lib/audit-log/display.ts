import {
    AUDIT_ENTITY_LABELS,
    getAuditActionLabel,
} from "@/constants/audit";
import { formatThaiDate } from "@/lib/helpers/date-helpers";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
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

const FIELD_LABELS: Record<string, string> = {
    assignedToId: "ผู้รับผิดชอบ",
    attributes: "คุณลักษณะ",
    businessDayPolicy: "การเลื่อนวันทำการ",
    category: "หมวดหมู่",
    categoryId: "หมวดหมู่",
    categoryName: "หมวดหมู่",
    contractText: "รายละเอียดสัญญา",
    contractEndDate: "วันสิ้นสุดสัญญา",
    contractStartDate: "วันเริ่มสัญญา",
    departmentId: "ฝ่าย/แผนก",
    description: "รายละเอียด",
    dueDate: "วันกำหนด",
    durationDays: "จำนวนวันลา",
    email: "อีเมล",
    extraDetails: "รายละเอียดเพิ่มเติม",
    firstName: "ชื่อ",
    imageUrl: "รูปภาพ",
    isActive: "สถานะใช้งาน",
    lastName: "นามสกุล",
    managerId: "ผู้อนุมัติการลา",
    minStock: "จำนวนขั้นต่ำ",
    name: "ชื่อ",
    nickname: "ชื่อเล่น",
    newMinStock: "จำนวนขั้นต่ำใหม่",
    newQty: "จำนวนใหม่",
    period: "ช่วงเวลา",
    position: "ตำแหน่ง",
    previousMinStock: "จำนวนขั้นต่ำเดิม",
    previousQty: "จำนวนเดิม",
    priority: "ความสำคัญ",
    projectCode: "โครงการ",
    quantity: "จำนวนคงเหลือ",
    reason: "เหตุผล",
    scheduleType: "รอบการทำงาน",
    scheduleText: "กำหนดการ",
    sku: "รหัสวัสดุ",
    status: "สถานะ",
    title: "หัวข้อ",
    type: "ประเภท",
    unit: "หน่วย",
    unitName: "หน่วยงาน",
};

const SENSITIVE_KEY_PARTS = ["password", "token", "session", "cookie", "secret"];
const DATE_FIELD_KEYS = new Set([
    "contractEndDate",
    "contractStartDate",
    "dueDate",
    "endDate",
    "startDate",
]);

const VALUE_LABELS: Record<string, string> = {
    ACTIVE: "เปิดใช้งาน",
    ADJUST: "ปรับยอด",
    APPROVED: "อนุมัติแล้ว",
    CANCELLED: "ยกเลิก",
    CANCELLED_AFTER_APPROVAL: "ยกเลิกหลังอนุมัติ",
    CANCELLATION_REQUESTED: "รอยืนยันการยกเลิก",
    CLOSED: "ปิดงาน",
    FAILED: "ไม่สำเร็จ",
    FULL_DAY: "เต็มวัน",
    IN: "เพิ่มสต็อก",
    INACTIVE: "ปิดใช้งาน",
    IN_PROGRESS: "กำลังดำเนินการ",
    ISSUED: "จ่ายแล้ว",
    MANUAL: "กำหนดเอง",
    MONTHLY_DAY: "รายเดือน",
    MONTH_END: "สิ้นเดือน",
    NOT_TAKEN: "ไม่ได้ใช้วันลา",
    OPEN: "เปิด",
    OUT: "ลดสต็อก",
    PENDING: "รอดำเนินการ",
    PENDING_ISSUE: "รอจ่าย",
    REJECTED: "ไม่อนุมัติ",
    REJECTED_LEGACY: "ไม่อนุมัติ",
    RESOLVED: "แก้ไขแล้ว",
    SUSPENDED: "ระงับใช้งาน",
};

const STOCK_ITEM_CHANGE_FIELDS = [
    "name",
    "description",
    "sku",
    "unit",
    "quantity",
    "minStock",
    "categoryName",
    "imageUrl",
    "isActive",
    "type",
] as const;

const STOCK_VARIANT_CHANGE_FIELDS = [
    "sku",
    "unit",
    "quantity",
    "minStock",
    "attributes",
    "imageUrl",
    "isActive",
] as const;

const ROUTINE_TASK_CHANGE_FIELDS = [
    "title",
    "description",
    "unitName",
    "categoryName",
    "scheduleType",
    "scheduleText",
    "businessDayPolicy",
    "contractStartDate",
    "contractEndDate",
    "contractText",
    "extraDetails",
    "isActive",
] as const;

const LEAVE_ACTIONS = new Set([
    "LEAVE_REQUEST_CREATE",
    "LEAVE_REQUEST_APPROVE",
    "LEAVE_REQUEST_REJECT",
    "LEAVE_REQUEST_CANCEL",
    "LEAVE_REQUEST_CANCELLATION_REQUEST",
    "LEAVE_REQUEST_CANCELLATION_CONFIRM",
    "LEAVE_REQUEST_NOT_TAKEN_REQUEST",
    "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
]);

const ROUTINE_ACTIONS = new Set([
    "ROUTINE_TASK_CREATE",
    "ROUTINE_TASK_UPDATE",
    "ROUTINE_TASK_DEACTIVATE",
    "ROUTINE_TASK_DELETE",
    "ROUTINE_OCCURRENCE_REASSIGN",
    "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE",
    "ROUTINE_IMPORT_UPLOAD",
    "ROUTINE_IMPORT_ROW_UPDATE",
    "ROUTINE_IMPORT_APPLY",
    "ROUTINE_IMPORT_CANCEL",
]);

const GENERIC_DIFF_ACTIONS = new Set([
    "EMPLOYEE_UPDATE",
    "EMPLOYEE_STATUS_CHANGE",
    "USER_UPDATE",
    "USER_ROLE_CHANGE",
    "SETTINGS_UPDATE",
]);

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

function getArray(source: Record<string, unknown>, key: string): unknown[] {
    const value = source[key];
    return Array.isArray(value) ? value : [];
}

function firstText(
    key: string,
    ...sources: Array<Record<string, unknown>>
): string | null {
    for (const source of sources) {
        const value = getText(source, key);
        if (value) return value;
    }
    return null;
}

function firstNumber(
    key: string,
    ...sources: Array<Record<string, unknown>>
): number | null {
    for (const source of sources) {
        const value = getNumber(source, key);
        if (value !== null) return value;
    }
    return null;
}

function isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function truncateText(value: string, maxLength = 120): string {
    return value.length <= maxLength
        ? value
        : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatAttributeList(value: unknown): string | null {
    if (!Array.isArray(value)) return null;

    const attributes = value.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const name = getText(entry, "name");
        const attributeValue = getText(entry, "value");
        if (!name || !attributeValue || isSensitiveKey(name)) return [];
        return [`${name}: ${attributeValue}`];
    });

    return attributes.length > 0 ? attributes.join(", ") : "ไม่มี";
}

function formatImageChange(before: unknown, after: unknown): string {
    const hadImage = typeof before === "string" && before.trim().length > 0;
    const hasImage = typeof after === "string" && after.trim().length > 0;
    if (!hadImage && hasImage) return "เพิ่มรูปภาพ";
    if (hadImage && !hasImage) return "นำรูปภาพออก";
    return "เปลี่ยนรูปภาพ";
}

function formatDateValue(value: unknown): string | null {
    if (value === null || value === undefined || value === "") return "ว่าง";
    if (typeof value !== "string") return null;
    const formatted = formatThaiDate(value);
    return formatted === "-" ? null : formatted;
}

function formatValue(value: unknown): string | null {
    if (typeof value === "boolean") return value ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (typeof value === "number") return value.toLocaleString("th-TH");
    if (typeof value === "string" && value.trim()) {
        return VALUE_LABELS[value.trim()] ?? truncateText(value.trim());
    }
    if (value === null || value === undefined || value === "") return "ว่าง";
    return null;
}

function valuesDiffer(before: unknown, after: unknown): boolean {
    return JSON.stringify(before) !== JSON.stringify(after);
}

function formatChangedField(
    key: string,
    beforeValue: unknown,
    afterValue: unknown,
): string | null {
    if (isSensitiveKey(key) || !valuesDiffer(beforeValue, afterValue)) return null;
    const label = FIELD_LABELS[key] ?? key;

    if (key === "imageUrl") {
        return `${label}: ${formatImageChange(beforeValue, afterValue)}`;
    }
    if (key === "attributes") {
        const beforeAttributes = formatAttributeList(beforeValue);
        const afterAttributes = formatAttributeList(afterValue);
        if (beforeAttributes === null || afterAttributes === null) return null;
        return `${label}: ${beforeAttributes} → ${afterAttributes}`;
    }
    if (DATE_FIELD_KEYS.has(key)) {
        const beforeDate = formatDateValue(beforeValue);
        const afterDate = formatDateValue(afterValue);
        if (beforeDate !== null && afterDate !== null) {
            return `${label}: ${beforeDate} → ${afterDate}`;
        }
    }

    const beforeText = formatValue(beforeValue);
    const afterText = formatValue(afterValue);
    if (beforeText === null || afterText === null) return null;
    return `${label}: ${beforeText} → ${afterText}`;
}

function getChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    allowedKeys?: readonly string[],
): string[] {
    const keys = allowedKeys
        ?? [...new Set([...Object.keys(before), ...Object.keys(after)])];

    return keys.flatMap((key) => {
        if (!(key in after)) return [];
        const change = formatChangedField(key, before[key], after[key]);
        return change ? [change] : [];
    });
}

function getDisplayName(source: Record<string, unknown>): string | null {
    const firstName = getText(source, "firstName");
    const lastName = getText(source, "lastName");
    const employeeName = firstName || lastName
        ? getEmployeeDisplayName({
              firstName: firstName ?? "",
              lastName: lastName ?? "",
              nickname: getText(source, "nickname"),
          })
        : null;
    return employeeName || getText(source, "name") || getText(source, "title")
        || getText(source, "email") || getText(source, "sku");
}

function quote(value: string): string {
    return `“${value}”`;
}

function formatStockTarget(
    name: string | null,
    sku: string | null,
): string {
    const nameText = name ? ` ${quote(name)}` : "";
    const skuText = sku ? ` (SKU: ${sku})` : "";
    return `${nameText}${skuText}`;
}

function formatStockItemUpdate(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
): string {
    const name = firstText("name", after, before);
    const sku = firstText("sku", after, before);
    const changes = getStockItemChangedFields(before, after);
    const prefix = `แก้ไขวัสดุ${formatStockTarget(name, sku)}`;
    return changes.length > 0 ? `${prefix}: ${changes.join(", ")}` : prefix;
}

function getStockItemChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
): string[] {
    const changes = getChangedFields(before, after, STOCK_ITEM_CHANGE_FIELDS);
    if ("categoryName" in before || "categoryName" in after) return changes;

    const legacyCategoryChange = formatChangedField(
        "categoryId",
        before.categoryId,
        after.categoryId,
    );
    return legacyCategoryChange ? [...changes, legacyCategoryChange] : changes;
}

function getVariantLabel(
    after: Record<string, unknown>,
    before: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string | null {
    const explicitLabel = getText(metadata, "variantLabel");
    if (explicitLabel) return explicitLabel;
    const attributes = formatAttributeList(after.attributes ?? before.attributes);
    if (attributes && attributes !== "ไม่มี") return attributes;
    return firstText("sku", after, before);
}

function formatStockVariantAction(
    action: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string {
    const itemName = getText(metadata, "itemName");
    const variantLabel = getVariantLabel(after, before, metadata);
    const targetName = [itemName, variantLabel].filter(Boolean).join(" / ");
    const changes = getChangedFields(before, after, STOCK_VARIANT_CHANGE_FIELDS);
    const actionLabel = action === "STOCK_ITEM_CREATE"
        ? "สร้างรายการย่อย"
        : action === "STOCK_ITEM_DELETE"
            ? "ลบรายการย่อย"
            : "แก้ไขรายการย่อย";
    const prefix = `${actionLabel}${targetName ? ` ${quote(targetName)}` : ""}`;
    return changes.length > 0 && action === "STOCK_ITEM_UPDATE"
        ? `${prefix}: ${changes.join(", ")}`
        : prefix;
}

function formatStockAdjustment(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string | null {
    const previousQty = firstNumber("variantQuantity", before)
        ?? firstNumber("quantity", before, after);
    const newQty = firstNumber("variantQuantity", after)
        ?? firstNumber("newQty", after)
        ?? firstNumber("quantity", after);
    const quantity = firstNumber("adjustmentQuantity", metadata, after);
    if (previousQty === null || newQty === null || quantity === null) return null;

    const itemName = firstText("itemName", metadata)
        ?? firstText("name", after, before);
    const sku = firstText("itemSku", metadata)
        ?? firstText("sku", after, before);
    const variantLabel = getText(metadata, "variantLabel");
    const targetName = [itemName, variantLabel].filter(Boolean).join(" / ");
    const unit = firstText("unit", metadata, after, before);
    const typeLabel = quantity >= 0 ? "เพิ่ม" : "ลด";
    const unitText = unit ? ` ${unit}` : "";
    const minStockChange = formatChangedField(
        "minStock",
        before.variantMinStock ?? before.minStock,
        after.variantMinStock ?? after.minStock,
    );
    const prefix = `ปรับยอดวัสดุ${formatStockTarget(targetName || null, sku)}`;
    const balance = `${typeLabel} ${Math.abs(quantity).toLocaleString("th-TH")}${unitText} จาก ${previousQty.toLocaleString("th-TH")} เป็น ${newQty.toLocaleString("th-TH")}`;
    return minStockChange ? `${prefix}: ${balance}, ${minStockChange}` : `${prefix}: ${balance}`;
}

function getStockRequestReference(
    entityId: number | null,
    metadata: Record<string, unknown>,
): string {
    const requestId = entityId ?? getNumber(metadata, "stockRequestId");
    return requestId === null ? "" : ` #${requestId}`;
}

function getStockRequestCount(
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): number | null {
    const lines = getArray(metadata, "lines");
    return lines.length > 0 ? lines.length : getNumber(after, "itemCount");
}

function formatStockRequest(
    action: string,
    entityId: number | null,
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string {
    const reference = getStockRequestReference(entityId, metadata);
    const projectCode = firstText("projectCode", metadata, after);
    const project = projectCode ? ` โครงการ ${projectCode}` : "";
    const count = getStockRequestCount(after, metadata);
    const countText = count === null
        ? ""
        : ` จำนวน ${count.toLocaleString("th-TH")} รายการ`;

    if (action === "STOCK_REQUEST_CANCEL") {
        const reason = getText(metadata, "reason");
        return `ยกเลิกคำขอเบิก${reference}${reason ? `: ${truncateText(reason)}` : project}`;
    }
    if (action === "STOCK_REQUEST_ISSUE") {
        return `จ่ายคำขอเบิก${reference}${project}${countText}`;
    }
    return `สร้างคำขอเบิก${reference}${project}${countText}`;
}

function isLeaveType(value: string | null): value is LeaveTypeValue {
    return value === "SICK" || value === "PERSONAL" || value === "VACATION";
}

function isLeavePeriod(value: string | null): value is LeavePeriodValue {
    return value === "FULL_DAY" || value === "MORNING" || value === "AFTERNOON";
}

function getLeaveContext(metadata: Record<string, unknown>): {
    leaveTypeLabel: string;
    employeeName: string | null;
    dateRange: string;
    duration: string;
    periodLabel: string;
} | null {
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

    return {
        leaveTypeLabel: getLeaveTypeLabel(leaveType),
        employeeName: getText(metadata, "employeeName"),
        dateRange: formatLeaveDateRange(startDate, endDate),
        duration: formatLeaveDurationDays(durationDays),
        periodLabel: getLeavePeriodLabel(period),
    };
}

function getLeaveReason(
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string | null {
    return firstText("reason", metadata, after)
        ?? getText(metadata, "overrideReason")
        ?? getText(metadata, "note");
}

function formatLeaveAction(
    action: string,
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string {
    const context = getLeaveContext(metadata);
    const reason = getLeaveReason(after, metadata);
    if (!context) {
        return reason
            ? `${getAuditActionLabel(action)}: ${truncateText(reason)}`
            : getAuditActionLabel(action);
    }

    const employee = context.employeeName
        ? `ของ ${context.employeeName}`
        : "";
    const leaveDescription = `คำขอ${context.leaveTypeLabel}${employee} วันที่ ${context.dateRange}`;
    if (action === "LEAVE_REQUEST_CREATE") {
        return `ยื่น${leaveDescription} จำนวน ${context.duration} วัน (${context.periodLabel})`;
    }
    if (action === "LEAVE_REQUEST_APPROVE") {
        return `อนุมัติ${leaveDescription}`;
    }
    if (action === "LEAVE_REQUEST_REJECT") {
        return `ไม่อนุมัติ${leaveDescription}${reason ? `: ${truncateText(reason)}` : ""}`;
    }
    if (action === "LEAVE_REQUEST_CANCEL") {
        return `ยกเลิก${leaveDescription}${reason ? `: ${truncateText(reason)}` : ""}`;
    }
    if (action === "LEAVE_REQUEST_CANCELLATION_REQUEST") {
        return `ขอยกเลิก${leaveDescription}${reason ? `: ${truncateText(reason)}` : ""}`;
    }
    if (action === "LEAVE_REQUEST_CANCELLATION_CONFIRM") {
        const decision = getText(metadata, "decision");
        const verb = decision === "REJECT" ? "ไม่ยืนยันการยกเลิก" : "ยืนยันยกเลิก";
        return `${verb}${leaveDescription}${reason ? `: ${truncateText(reason)}` : ""}`;
    }
    if (action === "LEAVE_REQUEST_NOT_TAKEN_REQUEST") {
        return `แจ้งไม่ได้ใช้${leaveDescription}${reason ? `: ${truncateText(reason)}` : ""}`;
    }
    return `ยืนยันไม่ได้ใช้${leaveDescription}`;
}

function formatEmployeeApproverChange(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string {
    const employeeName = getText(metadata, "employeeName");
    const previousName = firstText("previousApproverName", metadata)
        ?? firstText("managerName", before);
    const newName = firstText("newApproverName", metadata)
        ?? firstText("managerName", after);
    const employee = employeeName ? `ของ ${employeeName}` : "";
    return `เปลี่ยนผู้อนุมัติการลา${employee}: ${previousName ?? "ไม่ได้กำหนด"} → ${newName ?? "ไม่ได้กำหนด"}`;
}

function formatRoutineAction(
    action: string,
    entityId: number | null,
    details: Record<string, unknown>,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
): string {
    const taskTitle = firstText("taskTitle", details)
        ?? firstText("title", after, before, details);
    const target = taskTitle
        ? ` ${quote(taskTitle)}`
        : entityId === null ? "" : ` #${entityId}`;

    if (action === "ROUTINE_TASK_CREATE") return `สร้างแม่แบบงานประจำ${target}`;
    if (action === "ROUTINE_TASK_DEACTIVATE") return `ปิดใช้งานแม่แบบงานประจำ${target}`;
    if (action === "ROUTINE_TASK_DELETE") return `ลบแม่แบบงานประจำ${target}`;
    if (action === "ROUTINE_TASK_UPDATE") {
        const changes = getChangedFields(before, after, ROUTINE_TASK_CHANGE_FIELDS);
        if (details.assigneesChanged === true) {
            changes.push("เปลี่ยนผู้รับผิดชอบ");
        }
        if (details.reminderRulesChanged === true) {
            changes.push("เปลี่ยนการแจ้งเตือน");
        }
        return changes.length > 0
            ? `แก้ไขแม่แบบงานประจำ${target}: ${changes.join(", ")}`
            : `แก้ไขแม่แบบงานประจำ${target}`;
    }
    if (action === "ROUTINE_OCCURRENCE_DUE_DATE_CHANGE") {
        const oldDueDate = firstText("oldDueDate", details)
            ?? firstText("dueDate", before);
        const newDueDate = firstText("newDueDate", details)
            ?? firstText("dueDate", after);
        const change = oldDueDate && newDueDate
            ? `: ${formatThaiDate(oldDueDate)} → ${formatThaiDate(newDueDate)}`
            : "";
        return `เปลี่ยนวันกำหนดรอบงาน${target}${change}`;
    }
    if (action === "ROUTINE_OCCURRENCE_REASSIGN") {
        const previousCount = getArray(details, "previousEmployeeIds").length
            || getArray(before, "assignees").length;
        const newCount = getArray(details, "affectedEmployeeIds").length
            || getArray(after, "assignees").length;
        const change = previousCount > 0 || newCount > 0
            ? `: ${previousCount.toLocaleString("th-TH")} คน → ${newCount.toLocaleString("th-TH")} คน`
            : "";
        return `เปลี่ยนผู้รับผิดชอบรอบงาน${target}${change}`;
    }
    if (action === "ROUTINE_IMPORT_UPLOAD") {
        const fileName = getText(details, "fileName");
        const totalRows = getNumber(details, "totalRows");
        return `อัปโหลดไฟล์งานประจำ${fileName ? ` ${quote(fileName)}` : ""}${totalRows === null ? "" : ` จำนวน ${totalRows.toLocaleString("th-TH")} แถว`}`;
    }
    if (action === "ROUTINE_IMPORT_ROW_UPDATE") {
        const sourceKey = getText(details, "sourceKey");
        return `แก้ไขแถวนำเข้างานประจำ${sourceKey ? ` ${quote(sourceKey)}` : target}`;
    }
    if (action === "ROUTINE_IMPORT_APPLY") {
        const targetSheet = getText(details, "targetSheet");
        const appliedRows = getNumber(details, "appliedRows");
        return `นำเข้างานประจำ${targetSheet ? `จาก ${quote(targetSheet)}` : ""}${appliedRows === null ? "" : ` สำเร็จ ${appliedRows.toLocaleString("th-TH")} รายการ`}`;
    }

    const targetSheet = getText(details, "targetSheet");
    return `ยกเลิกการนำเข้างานประจำ${targetSheet ? ` ${quote(targetSheet)}` : target}`;
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
    const details = input.details ?? {};
    const before = getSection(input.details, "before");
    const after = getSection(input.details, "after");
    const metadata = getSection(input.details, "metadata");
    const name = getDisplayName(after) ?? getDisplayName(before);
    const changes = getChangedFields(before, after);

    if (input.action === "STOCK_ITEM_UPDATE") {
        return input.entityType === "StockVariant"
            ? formatStockVariantAction(input.action, before, after, metadata)
            : formatStockItemUpdate(before, after);
    }
    if (
        (input.action === "STOCK_ITEM_CREATE" || input.action === "STOCK_ITEM_DELETE")
        && input.entityType === "StockVariant"
    ) {
        return formatStockVariantAction(input.action, before, after, metadata);
    }
    if (input.action === "STOCK_ADJUST") {
        return formatStockAdjustment(before, after, metadata) ?? "ปรับยอดสต็อก";
    }
    if (
        input.action === "STOCK_REQUEST_CREATE"
        || input.action === "STOCK_REQUEST_ISSUE"
        || input.action === "STOCK_REQUEST_CANCEL"
    ) {
        return formatStockRequest(input.action, input.entityId, after, metadata);
    }
    if (LEAVE_ACTIONS.has(input.action)) {
        return formatLeaveAction(input.action, after, metadata);
    }
    if (input.action === "EMPLOYEE_UPDATE" && input.entityType === "EmployeeApprover") {
        return formatEmployeeApproverChange(before, after, metadata);
    }
    if (ROUTINE_ACTIONS.has(input.action)) {
        return formatRoutineAction(
            input.action,
            input.entityId,
            details,
            before,
            after,
        );
    }
    if (input.action === "DATA_EXPORT") {
        return formatDataExportSummary(input.entityType, metadata)
            ?? getAuditActionLabel(input.action);
    }

    if (GENERIC_DIFF_ACTIONS.has(input.action) && changes.length > 0) {
        return `แก้ไข${getEntityLabel(input.entityType)}: ${changes.join(", ")}`;
    }
    return name ? `${getAuditActionLabel(input.action)}: ${name}` : getAuditActionLabel(input.action);
}

function getActionChangedFields(
    input: AuditLogDisplayInput,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    metadata: Record<string, unknown>,
): string[] {
    if (input.action === "EMPLOYEE_UPDATE" && input.entityType === "EmployeeApprover") {
        const previousName = firstText("previousApproverName", metadata)
            ?? firstText("managerName", before)
            ?? "ไม่ได้กำหนด";
        const newName = firstText("newApproverName", metadata)
            ?? firstText("managerName", after)
            ?? "ไม่ได้กำหนด";
        return previousName === newName ? [] : [`ผู้อนุมัติการลา: ${previousName} → ${newName}`];
    }
    if (input.action === "STOCK_ITEM_UPDATE") {
        return input.entityType === "StockVariant"
            ? getChangedFields(before, after, STOCK_VARIANT_CHANGE_FIELDS)
            : getStockItemChangedFields(before, after);
    }
    if (input.action === "ROUTINE_TASK_UPDATE") {
        const changedFields = getChangedFields(
            before,
            after,
            ROUTINE_TASK_CHANGE_FIELDS,
        );
        const details = input.details ?? {};
        if (details.assigneesChanged === true) {
            changedFields.push("ผู้รับผิดชอบ: มีการเปลี่ยนแปลง");
        }
        if (details.reminderRulesChanged === true) {
            changedFields.push("การแจ้งเตือน: มีการเปลี่ยนแปลง");
        }
        return changedFields;
    }
    return getChangedFields(before, after);
}

export function getEntityLabel(entityType: string): string {
    return (AUDIT_ENTITY_LABELS as Record<string, string>)[entityType]
        ?? entityType;
}

export function formatAuditLogDisplay(
    input: AuditLogDisplayInput,
): AuditLogDisplay {
    const entityLabel = getEntityLabel(input.entityType);
    const entityReference = input.entityId
        ? `${entityLabel} #${input.entityId}`
        : entityLabel;
    const before = getSection(input.details, "before");
    const after = getSection(input.details, "after");
    const metadata = getSection(input.details, "metadata");

    return {
        entityLabel,
        entityReference,
        summary: buildActionSummary(input),
        changedFields: getActionChangedFields(
            input,
            before,
            after,
            metadata,
        ),
    };
}
