"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";
import { routineImportRowUpdateSchema } from "@/lib/validations/routine-import";
import {
    formatRoutineSendTime,
    parseRoutineSendTime,
    ROUTINE_DEFAULT_REMINDER_TIME,
    type RoutineBusinessDayPolicy,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";
import {
    addRoutineAssignee,
    normalizeRoutineAssignees,
    removeRoutineAssignee,
    setRoutineAssigneeRole,
} from "@/lib/routine/assignees";
import type { RoutineAssigneeRole } from "./types";

import { RoutineAssigneePicker } from "./RoutineAssigneePicker";
import {
    RoutineReminderFields,
    getRoutineReminderFieldErrors,
    getRoutineReminderPresetDays,
    type RoutineReminderPreset,
    type RoutineReminderRuleForm,
} from "./RoutineReminderFields";
import { RoutineScheduleFields } from "./RoutineScheduleFields";
import { focusFirstRoutineInvalidField } from "./focus-invalid-field";
import { routineFormSnapshot } from "./form-dirty-state";
import type {
    RoutineImportReference,
    RoutineImportRowEdit,
    RoutineImportRowStatus,
    RoutineImportRowView,
} from "./import-types";

interface RoutineImportRowEditorProps {
    batchId: number;
    row: RoutineImportRowView | null;
    reference: RoutineImportReference;
    open: boolean;
    disabled?: boolean;
    readOnlyReason?: string;
    onOpenChange: (open: boolean) => void;
    onSaved: (row: RoutineImportRowView) => void;
    onConflict?: () => Promise<void> | void;
}

type AssigneeState = Record<number, "OWNER" | "CO_OWNER">;
type ReminderRule = RoutineReminderRuleForm;
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(value: unknown): string {
    if (isRecord(value) && typeof value.error === "string") return value.error;
    return "บันทึกแถวไม่สำเร็จ";
}

function toJsonObject(value: Record<string, unknown>): Record<string, JsonValue> {
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean"
                ? item
                : null,
        ]),
    );
}

function defaultScheduleType(row: RoutineImportRowView): RoutineScheduleType {
    return row.data.normalizedSchedule?.scheduleType ?? "MANUAL";
}

function defaultScheduleConfig(row: RoutineImportRowView): Record<string, unknown> {
    const value = row.data.normalizedSchedule?.scheduleConfig;
    return isRecord(value) ? value : {};
}

function defaultBusinessDayPolicy(row: RoutineImportRowView): RoutineBusinessDayPolicy {
    return row.data.normalizedSchedule?.businessDayPolicy ?? "NONE";
}

function normalizeAssignees(row: RoutineImportRowView): AssigneeState {
    const source = row.data.mappedAssignees ?? row.data.mappedEmployeeIds.map((employeeId, index) => ({
        employeeId,
        role: index === 0 ? "OWNER" as const : "CO_OWNER" as const,
    }));
    const next: AssigneeState = {};
    for (const assignee of source) {
        if (next[assignee.employeeId] !== undefined) continue;
        next[assignee.employeeId] = assignee.role;
    }
    return normalizeRoutineAssignees(next);
}

const ROUTINE_IMPORT_ROW_STATUSES: readonly RoutineImportRowStatus[] = [
    "VALID",
    "REQUIRES_REVIEW",
    "EXCLUDED",
    "ALREADY_IMPORTED",
    "CONFLICT",
    "APPLIED",
    "FAILED",
];

function isRoutineImportRowStatus(value: unknown): value is RoutineImportRowStatus {
    return typeof value === "string"
        && ROUTINE_IMPORT_ROW_STATUSES.includes(value as RoutineImportRowStatus);
}

function isRoutineImportRowView(value: unknown): value is RoutineImportRowView {
    if (!isRecord(value) || !isRoutineImportRowStatus(value.status)) return false;
    return typeof value.id === "number"
        && typeof value.sourceRow === "number"
        && typeof value.version === "number"
        && typeof value.selected === "boolean"
        && Array.isArray(value.reviewReasons)
        && value.reviewReasons.every((reason) => typeof reason === "string")
        && isRecord(value.data)
        && typeof value.data.title === "string"
        && Array.isArray(value.data.mappedEmployeeIds);
}

function parseRoutineImportRowView(value: unknown): RoutineImportRowView {
    if (!isRoutineImportRowView(value)) throw new Error("ผลลัพธ์แถวจากเซิร์ฟเวอร์ไม่ถูกต้อง");
    return value;
}

function reviewReasonLabel(reason: string): string {
    const [code, detail] = reason.split(":", 2);
    const labels: Record<string, string> = {
        MISSING_OWNER: "ไม่มีผู้รับผิดชอบ",
        OWNER_MAPPING_EMPLOYEE_NOT_FOUND: "ยังจับคู่พนักงานไม่ได้",
        OWNER_MAPPING_EMPLOYEE_INACTIVE: "พนักงานไม่พร้อมใช้งาน",
        DUPLICATE_OWNER: "ผู้รับผิดชอบซ้ำกันไม่ได้",
        INVALID_OWNER_ROLE: "ต้องมีผู้รับผิดชอบหลัก 1 คน",
        INVALID_CONTRACT_DATE_RANGE: "ช่วงสัญญาไม่ถูกต้อง",
        MISSING_CATEGORY: "ไม่มีหมวดงาน",
        MISSING_TITLE: "ไม่มีชื่อรายการ",
        MISSING_UNIT: "ไม่มีหน่วยงาน",
        INACTIVE_UNIT: "หน่วยงานไม่พร้อมใช้งาน",
        INACTIVE_CATEGORY: "หมวดงานไม่พร้อมใช้งาน",
        PLACEHOLDER_ROW: "รายการอ้างอิงหรือ placeholder",
    };
    return `${labels[code] ?? code}${detail ? ` (${detail})` : ""}`;
}

export function RoutineImportRowEditor({
    batchId,
    row,
    reference,
    open,
    disabled = false,
    readOnlyReason,
    onOpenChange,
    onSaved,
    onConflict,
}: RoutineImportRowEditorProps) {
    const [categoryName, setCategoryName] = useState("");
    const [title, setTitle] = useState("");
    const [assignees, setAssignees] = useState<AssigneeState>({});
    const [scheduleText, setScheduleText] = useState("");
    const [scheduleType, setScheduleType] = useState<RoutineScheduleType>("MANUAL");
    const [scheduleConfig, setScheduleConfig] = useState<Record<string, unknown>>({});
    const [businessDayPolicy, setBusinessDayPolicy] = useState<RoutineBusinessDayPolicy>("NONE");
    const [contractStartDate, setContractStartDate] = useState<string | null>(null);
    const [contractEndDate, setContractEndDate] = useState<string | null>(null);
    const [contractText, setContractText] = useState<string | null>(null);
    const [extraDetails, setExtraDetails] = useState<string | null>(null);
    const [selected, setSelected] = useState(false);
    const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
    const [reminderPreset, setReminderPreset] = useState<RoutineReminderPreset | "">("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
    const saveLockRef = useRef(false);
    const initializedRowIdRef = useRef<number | null>(null);
    const initialSnapshotRef = useRef<string | null>(null);

    const currentSnapshot = routineFormSnapshot({
        categoryName,
        title,
        assignees,
        scheduleText,
        scheduleType,
        scheduleConfig,
        businessDayPolicy,
        contractStartDate,
        contractEndDate,
        contractText,
        extraDetails,
        selected,
        reminderRules,
    });

    useEffect(() => {
        if (!row) {
            initializedRowIdRef.current = null;
            return;
        }
        if (initializedRowIdRef.current === row.id) return;
        initializedRowIdRef.current = row.id;
        const normalizedAssignees = normalizeAssignees(row);
        const nextReminderRules = (row.data.reminderRules ?? []).map((rule) => ({
            daysBefore: String(rule.daysBefore),
            sendHour: formatRoutineSendTime(rule.sendHour),
            recipientScope: rule.recipientScope,
            isActive: rule.isActive,
        }));
        const nextScheduleType = defaultScheduleType(row);
        const nextScheduleConfig = defaultScheduleConfig(row);
        const nextBusinessDayPolicy = defaultBusinessDayPolicy(row);
        const nextContractStartDate = row.data.contractStartDate;
        const nextContractEndDate = row.data.contractEndDate;
        const nextContractText = row.data.contractText;
        const nextExtraDetails = row.data.extraDetails;
        const nextSelected = row.status === "REQUIRES_REVIEW" ? true : row.selected;
        initialSnapshotRef.current = routineFormSnapshot({
            categoryName: row.data.categoryName,
            title: row.data.title,
            assignees: normalizedAssignees,
            scheduleText: row.data.scheduleText ?? "",
            scheduleType: nextScheduleType,
            scheduleConfig: nextScheduleConfig,
            businessDayPolicy: nextBusinessDayPolicy,
            contractStartDate: nextContractStartDate,
            contractEndDate: nextContractEndDate,
            contractText: nextContractText,
            extraDetails: nextExtraDetails,
            selected: nextSelected,
            reminderRules: nextReminderRules,
        });
        setCategoryName(row.data.categoryName);
        setTitle(row.data.title);
        setAssignees(normalizedAssignees);
        setScheduleText(row.data.scheduleText ?? "");
        setScheduleType(nextScheduleType);
        setScheduleConfig(nextScheduleConfig);
        setBusinessDayPolicy(nextBusinessDayPolicy);
        setContractStartDate(nextContractStartDate);
        setContractEndDate(nextContractEndDate);
        setContractText(nextContractText);
        setExtraDetails(nextExtraDetails);
        setSelected(nextSelected);
        setReminderRules(nextReminderRules);
        setError(null);
        setNotice(null);
        setFieldErrors({});
        setReminderPreset("");
        setDiscardConfirmOpen(false);
    }, [row]);

    const isDirty = initialSnapshotRef.current !== null
        && currentSnapshot !== initialSnapshotRef.current;

    function requestClose(): void {
        if (saving) return;
        if (isDirty) {
            setDiscardConfirmOpen(true);
            return;
        }
        onOpenChange(false);
    }

    function discardChanges(): void {
        setDiscardConfirmOpen(false);
        onOpenChange(false);
    }

    function toggleEmployee(employeeId: number): void {
        setAssignees((current) => current[employeeId]
            ? removeRoutineAssignee(current, employeeId)
            : addRoutineAssignee(current, employeeId));
    }

    function updateAssigneeRole(employeeId: number, role: RoutineAssigneeRole): void {
        setAssignees((current) => setRoutineAssigneeRole(current, employeeId, role));
    }

    function applyReminderPreset(value: RoutineReminderPreset): void {
        const days = getRoutineReminderPresetDays(value);
        if (days.length === 0) return;
        setReminderPreset(value);
        setReminderRules(days.map((daysBefore) => ({
            daysBefore: String(daysBefore),
            sendHour: ROUTINE_DEFAULT_REMINDER_TIME,
            recipientScope: "ASSIGNEES",
            isActive: true,
        })));
    }

    function addReminderRule(daysBefore = 1): void {
        setReminderPreset("");
        setReminderRules((current) => [
            ...current,
            {
                daysBefore: String(daysBefore),
                sendHour: ROUTINE_DEFAULT_REMINDER_TIME,
                recipientScope: "ASSIGNEES",
                isActive: true,
            },
        ]);
    }

    function updateReminderRule(index: number, patch: Partial<RoutineReminderRuleForm>): void {
        setReminderPreset("");
        setReminderRules((current) => current.map((rule, itemIndex) => (
            itemIndex === index ? { ...rule, ...patch } : rule
        )));
    }

    function removeReminderRule(index: number): void {
        setReminderPreset("");
        setReminderRules((current) => current.filter((_, itemIndex) => itemIndex !== index));
    }

    async function save(): Promise<void> {
        if (!row || disabled || saveLockRef.current) return;
        saveLockRef.current = true;
        setError(null);
        setNotice(null);
        setFieldErrors({});
        const reminderFieldErrors = getRoutineReminderFieldErrors(reminderRules);
        if (Object.keys(reminderFieldErrors).length > 0) {
            setFieldErrors(reminderFieldErrors);
            setError("กรุณาตรวจสอบรูปแบบการแจ้งเตือนในช่องที่มีเครื่องหมายเตือน");
            focusFirstRoutineInvalidField(reminderFieldErrors);
            saveLockRef.current = false;
            return;
        }
        const payload: RoutineImportRowEdit = {
            version: row.version,
            categoryName,
            title,
            mappedAssignees: Object.entries(assignees).map(([employeeId, role]) => ({
                employeeId: Number(employeeId),
                role,
            })),
            scheduleText: scheduleText.trim() || null,
            scheduleType,
            scheduleConfig: toJsonObject(scheduleConfig),
            businessDayPolicy,
            contractStartDate,
            contractEndDate,
            contractText: contractText?.trim() || null,
            extraDetails: extraDetails?.trim() || null,
            selected,
            reminderRules: (reminderRules ?? []).map((rule) => ({
                daysBefore: Number(rule.daysBefore),
                sendHour: parseRoutineSendTime(rule.sendHour) ?? -1,
                channel: "IN_APP" as const,
                recipientScope: rule.recipientScope,
                isActive: rule.isActive,
            })),
        };
        const parsed = routineImportRowUpdateSchema.safeParse(payload);
        if (!parsed.success) {
            const nextErrors = parsed.error.issues.reduce<Record<string, string>>(
                (errors, issue) => {
                    const path = issue.path.join(".") || "form";
                    if (!errors[path]) errors[path] = issue.message;
                    return errors;
                },
                {},
            );
            setFieldErrors(nextErrors);
            setError("ข้อมูลแถวไม่ครบถ้วน กรุณาตรวจสอบช่องที่กรอก");
            focusFirstRoutineInvalidField(nextErrors);
            saveLockRef.current = false;
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(
                API_ROUTES.routines.imports.rowById(batchId, row.id),
                {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(parsed.data),
                },
            );
            const body: unknown = await response.json().catch(() => null);
            if (response.status === 409) {
                const message = "ข้อมูลแถวถูกแก้ไขจาก session อื่น กำลังโหลดข้อมูลล่าสุด";
                setError(message);
                toast.error(message);
                await onConflict?.();
                return;
            }
            if (!response.ok) throw new Error(responseError(body));
            if (!isRecord(body) || !isRecord(body.row)) throw new Error("ผลลัพธ์จากเซิร์ฟเวอร์ไม่ถูกต้อง");
            const savedRow = parseRoutineImportRowView(body.row);
            onSaved(savedRow);
            if (savedRow.status === "REQUIRES_REVIEW") {
                const savedAssignees = normalizeAssignees(savedRow);
                setAssignees(savedAssignees);
                setSelected(savedRow.selected);
                initialSnapshotRef.current = routineFormSnapshot({
                    categoryName,
                    title,
                    assignees: savedAssignees,
                    scheduleText,
                    scheduleType,
                    scheduleConfig,
                    businessDayPolicy,
                    contractStartDate,
                    contractEndDate,
                    contractText,
                    extraDetails,
                    selected: savedRow.selected,
                    reminderRules,
                });
                setNotice("บันทึกข้อมูลแล้ว แต่ยังมีรายการที่ต้องแก้ไข");
            } else if (savedRow.status === "VALID" || savedRow.status === "EXCLUDED") {
                initialSnapshotRef.current = currentSnapshot;
                toast.success(savedRow.status === "EXCLUDED" ? "บันทึกแถวและข้ามรายการแล้ว" : "บันทึกแถวพร้อมนำเข้าแล้ว");
                onOpenChange(false);
            } else {
                throw new Error("สถานะแถวจากเซิร์ฟเวอร์ไม่ถูกต้อง");
            }
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : "บันทึกแถวไม่สำเร็จ";
            setError(message);
            toast.error(message);
        } finally {
            setSaving(false);
            saveLockRef.current = false;
        }
    }

    if (!row) return null;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) onOpenChange(true); else requestClose(); }}>
            <DialogContent scrollMode="content" className="max-h-[90dvh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>แก้ไขแถวที่ {row.sourceRow}</DialogTitle>
                    <DialogDescription>
                        แก้ข้อมูล staging ได้ก่อนยืนยันนำเข้า ข้อมูลต้นฉบับจาก Excel จะยังคงเก็บไว้เพื่อเปรียบเทียบ
                    </DialogDescription>
                </DialogHeader>

                {disabled && readOnlyReason ? <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-foreground" role="status">{readOnlyReason}</div> : null}
                {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground" role="alert">{error}</p> : null}
                {notice ? <p className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-foreground" role="status">{notice}</p> : null}
                {row.reviewReasons.length > 0 ? (
                    <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-foreground">
                        <div className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />ประเด็นที่ระบบพบ</div>
                        <ul className="mt-1 space-y-1 text-sm leading-6">{row.reviewReasons.map((reason) => <li key={reason}>{reviewReasonLabel(reason)}</li>)}</ul>
                    </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        หมวดงาน
                        <select data-routine-field="categoryName" aria-invalid={Boolean(fieldErrors.categoryName)} className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} disabled={disabled || saving}>
                            <option value="">เลือกหมวดงาน</option>
                            {reference.categories.map((category) => (
                                <option
                                    key={category.id}
                                    value={category.name}
                                    disabled={!category.isActive}
                                >
                                    {category.name}{category.isActive ? "" : " (ไม่พร้อมใช้งาน)"}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.categoryName ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.categoryName}</span> : null}
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">
                        รายการ
                        <Input data-routine-field="title" aria-invalid={Boolean(fieldErrors.title)} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} disabled={disabled || saving} />
                        {fieldErrors.title ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.title}</span> : null}
                    </label>
                </div>

                <RoutineAssigneePicker
                    employees={reference.employees}
                    assignees={assignees}
                    onToggle={toggleEmployee}
                    onRoleChange={updateAssigneeRole}
                    note={`จาก Excel: ${row.data.ownerNames.join(", ") || "ไม่พบชื่อ"}`}
                    error={fieldErrors.assignees}
                    disabled={disabled || saving}
                />

                <details className="rounded-lg border border-border-subtle bg-surface-subtle p-4">
                    <summary className="cursor-pointer text-base font-semibold text-content-heading">แก้ไขข้อมูลเพิ่มเติม</summary>
                    <div className="mt-4 space-y-4">
                        <RoutineScheduleFields
                            scheduleType={scheduleType}
                            scheduleConfig={scheduleConfig}
                            businessDayPolicy={businessDayPolicy}
                            contractStartDate={contractStartDate ?? ""}
                            contractEndDate={contractEndDate ?? ""}
                            contractText={contractText ?? ""}
                            onScheduleTypeChange={setScheduleType}
                            onScheduleConfigChange={setScheduleConfig}
                            onBusinessDayPolicyChange={setBusinessDayPolicy}
                            onContractStartDateChange={(value) => setContractStartDate(value || null)}
                            onContractEndDateChange={(value) => setContractEndDate(value || null)}
                            onContractTextChange={(value) => setContractText(value || null)}
                            errors={fieldErrors}
                            disabled={disabled || saving}
                        />
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">กำหนดการจาก Excel / คำอธิบายเพิ่มเติม<Input data-routine-field="scheduleText" aria-invalid={Boolean(fieldErrors.scheduleText)} value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} maxLength={500} disabled={disabled || saving} />{fieldErrors.scheduleText ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.scheduleText}</span> : null}</label>
                            <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">รายละเอียดเพิ่มเติม<Textarea value={extraDetails ?? ""} onChange={(event) => setExtraDetails(event.target.value || null)} maxLength={5000} disabled={disabled || saving} /></label>
                        </div>

                        <RoutineReminderFields
                            rules={reminderRules}
                            selectedPreset={reminderPreset}
                            errors={fieldErrors}
                            disabled={disabled || saving}
                            onPresetChange={applyReminderPreset}
                            onAddRule={() => addReminderRule()}
                            onUpdateRule={updateReminderRule}
                            onRemoveRule={removeReminderRule}
                        />
                    </div>
                </details>

                <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-sm font-semibold text-content-body">
                        <input type="checkbox" checked={selected} onChange={(event) => setSelected(event.target.checked)} disabled={disabled || saving} />
                        เลือกรายการนี้เพื่อนำเข้า
                    </label>
                    <p className="text-sm leading-6 text-content-secondary">หากยังมีประเด็นที่ต้องแก้ ระบบจะยังไม่นำเข้าแถวนี้</p>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>ปิด</Button>
                    <Button type="button" onClick={() => void save()} disabled={disabled || saving} aria-busy={saving} aria-live="polite">
                        {saving ? (
                            <>
                                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                กำลังบันทึก…
                            </>
                        ) : <><Save /> บันทึกแถว</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
            <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>มีข้อมูลที่ยังไม่ได้บันทึก</AlertDialogTitle>
                        <AlertDialogDescription>
                            หากออกตอนนี้ การแก้ไขล่าสุดจะหายไป
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={discardChanges}>
                            ออกโดยไม่บันทึก
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
