"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";
import { routineImportRowUpdateSchema } from "@/lib/validations/routine-import";
import {
    formatRoutineSendTime,
    parseRoutineSendTime,
    type RoutineBusinessDayPolicy,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";
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
import type {
    RoutineImportReference,
    RoutineImportRowEdit,
    RoutineImportRowView,
} from "./import-types";

interface RoutineImportRowEditorProps {
    batchId: number;
    row: RoutineImportRowView | null;
    reference: RoutineImportReference;
    open: boolean;
    disabled?: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (row: RoutineImportRowView) => void;
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

export function RoutineImportRowEditor({
    batchId,
    row,
    reference,
    open,
    disabled = false,
    onOpenChange,
    onSaved,
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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const saveLockRef = useRef(false);

    useEffect(() => {
        if (!row) return;
        setCategoryName(row.data.categoryName);
        setTitle(row.data.title);
        setAssignees(
            Object.fromEntries(
                (row.data.mappedAssignees ?? row.data.mappedEmployeeIds.map((employeeId, index) => ({
                    employeeId,
                    role: index === 0 ? "OWNER" : "CO_OWNER",
                }))).map((assignee) => [assignee.employeeId, assignee.role]),
            ) as AssigneeState,
        );
        setScheduleText(row.data.scheduleText ?? "");
        setScheduleType(defaultScheduleType(row));
        setScheduleConfig(defaultScheduleConfig(row));
        setBusinessDayPolicy(defaultBusinessDayPolicy(row));
        setContractStartDate(row.data.contractStartDate);
        setContractEndDate(row.data.contractEndDate);
        setContractText(row.data.contractText);
        setExtraDetails(row.data.extraDetails);
        setSelected(row.selected);
        setReminderRules((row.data.reminderRules ?? []).map((rule) => ({
            daysBefore: String(rule.daysBefore),
            sendHour: formatRoutineSendTime(rule.sendHour),
            recipientScope: rule.recipientScope,
            isActive: rule.isActive,
        })));
        setError(null);
        setFieldErrors({});
        setReminderPreset("");
    }, [row]);

    function toggleEmployee(employeeId: number): void {
        setAssignees((current) => {
            const next = { ...current };
            if (next[employeeId]) {
                delete next[employeeId];
            } else {
                next[employeeId] = Object.keys(next).length === 0 ? "OWNER" : "CO_OWNER";
            }
            return next;
        });
    }

    function updateAssigneeRole(employeeId: number, role: RoutineAssigneeRole): void {
        setAssignees((current) => ({ ...current, [employeeId]: role }));
    }

    function applyReminderPreset(value: RoutineReminderPreset): void {
        const days = getRoutineReminderPresetDays(value);
        if (days.length === 0) return;
        setReminderPreset(value);
        setReminderRules(days.map((daysBefore) => ({
            daysBefore: String(daysBefore),
            sendHour: "09:00",
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
                sendHour: "09:00",
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
        if (!row || saveLockRef.current) return;
        saveLockRef.current = true;
        setError(null);
        setFieldErrors({});
        const reminderFieldErrors = getRoutineReminderFieldErrors(reminderRules);
        if (Object.keys(reminderFieldErrors).length > 0) {
            setFieldErrors(reminderFieldErrors);
            setError("กรุณาตรวจสอบรูปแบบการแจ้งเตือนในช่องที่มีเครื่องหมายเตือน");
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
            if (!response.ok) throw new Error(responseError(body));
            if (!isRecord(body) || !isRecord(body.row)) throw new Error("ผลลัพธ์จากเซิร์ฟเวอร์ไม่ถูกต้อง");
            toast.success("บันทึกแถวสำเร็จ");
            onSaved(body.row as unknown as RoutineImportRowView);
            onOpenChange(false);
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
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && saving) return; onOpenChange(nextOpen); }}>
            <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>แก้ไขแถวที่ {row.sourceRow}</DialogTitle>
                    <DialogDescription>
                        แก้ข้อมูล staging ได้ก่อนยืนยันนำเข้า ข้อมูลต้นฉบับจาก Excel จะยังคงเก็บไว้เพื่อเปรียบเทียบ
                    </DialogDescription>
                </DialogHeader>

                {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground" role="alert">{error}</p> : null}
                {row.reviewReasons.length > 0 ? (
                    <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-foreground">
                        <div className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />ประเด็นที่ระบบพบ</div>
                        <p className="mt-1 break-words text-sm leading-6">{row.reviewReasons.join(" · ")}</p>
                    </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        หมวดงาน
                        <select data-routine-field="categoryName" aria-invalid={Boolean(fieldErrors.categoryName)} className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} disabled={disabled || saving}>
                            <option value="">เลือกหมวดงาน</option>
                            {reference.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
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

                <label className="flex items-center gap-3 text-sm font-medium text-content-body">
                    <input type="checkbox" checked={selected} onChange={(event) => setSelected(event.target.checked)} disabled={disabled || saving} />
                    เลือกรายการนี้เพื่อนำเข้า
                </label>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ปิด</Button>
                    <Button type="button" onClick={() => void save()} disabled={disabled || saving}>
                        {saving ? "กำลังบันทึก..." : <><Save /> บันทึกแถว</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
