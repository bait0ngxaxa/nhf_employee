"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellPlus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";
import { routineImportRowUpdateSchema } from "@/lib/validations/routine-import";
import type { RoutineBusinessDayPolicy, RoutineScheduleType } from "@/lib/routine/schedule";
import type { RoutineReminderRecipientScope } from "./types";

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
type ReminderRule = RoutineImportRowEdit["reminderRules"][number];
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const REMINDER_SCOPE_LABELS: Record<RoutineReminderRecipientScope, string> = {
    ASSIGNEES: "ผู้รับผิดชอบ",
    ADMINS: "ผู้ดูแลระบบ",
    ASSIGNEES_AND_ADMINS: "ผู้รับผิดชอบและผู้ดูแลระบบ",
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function employeeName(employee: RoutineImportReference["employees"][number]): string {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    return employee.nickname && employee.nickname !== "-"
        ? `${fullName} (${employee.nickname})`
        : fullName;
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
    const [proposedActivation, setProposedActivation] = useState<"ACTIVE" | "INACTIVE">("INACTIVE");
    const [selected, setSelected] = useState(false);
    const [reminderRules, setReminderRules] = useState<RoutineImportRowEdit["reminderRules"]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        setProposedActivation(row.data.proposedActivation === "ACTIVE" ? "ACTIVE" : "INACTIVE");
        setSelected(row.selected);
        setReminderRules(row.data.reminderRules ?? []);
        setError(null);
    }, [row]);

    const selectedEmployeeIds = useMemo(() => new Set(Object.keys(assignees).map(Number)), [assignees]);

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

    function applyReminderPreset(value: string): void {
        const presets: Record<string, number[]> = {
            monthly: [3, 1],
            yearly: [14, 7, 1],
            contract: [30, 7, 1],
        };
        const days = presets[value];
        if (!days) return;
        setReminderRules(days.map((daysBefore) => ({
            daysBefore,
            sendHour: 9,
            channel: "IN_APP" as const,
            recipientScope: "ASSIGNEES" as const,
            isActive: true,
        })));
    }

    function addReminderRule(daysBefore = 1): void {
        setReminderRules((current) => [
            ...current,
            {
                daysBefore,
                sendHour: 9,
                channel: "IN_APP" as const,
                recipientScope: "ASSIGNEES" as const,
                isActive: true,
            },
        ]);
    }

    function updateReminderRule(index: number, patch: Partial<ReminderRule>): void {
        setReminderRules((current) => current.map((rule, itemIndex) => (
            itemIndex === index ? { ...rule, ...patch } : rule
        )));
    }

    function removeReminderRule(index: number): void {
        setReminderRules((current) => current.filter((_, itemIndex) => itemIndex !== index));
    }

    async function save(): Promise<void> {
        if (!row) return;
        setError(null);
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
            proposedActivation,
            selected,
            reminderRules: reminderRules ?? [],
        };
        const parsed = routineImportRowUpdateSchema.safeParse(payload);
        if (!parsed.success) {
            setError("ข้อมูลแถวไม่ครบถ้วน กรุณาตรวจสอบช่องที่กรอก");
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
            onSaved(body.row as unknown as RoutineImportRowView);
            onOpenChange(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "บันทึกแถวไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    }

    if (!row) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>แก้ไขแถวที่ {row.sourceRow}</DialogTitle>
                    <DialogDescription>
                        แก้ข้อมูล staging ได้ก่อนยืนยันนำเข้า ข้อมูลต้นฉบับจาก Excel จะยังคงเก็บไว้เพื่อเปรียบเทียบ
                    </DialogDescription>
                </DialogHeader>

                {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">{error}</p> : null}
                {row.reviewReasons.length > 0 ? (
                    <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-foreground">
                        <div className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />ประเด็นที่ระบบพบ</div>
                        <p className="mt-1 break-words text-xs">{row.reviewReasons.join(" · ")}</p>
                    </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        หมวดงาน
                        <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={categoryName} onChange={(event) => setCategoryName(event.target.value)}>
                            <option value="">เลือกหมวดงาน</option>
                            {reference.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        สถานะนำเข้า
                        <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={proposedActivation} onChange={(event) => setProposedActivation(event.target.value as "ACTIVE" | "INACTIVE")}>
                            <option value="ACTIVE">เปิดใช้งานทันที</option>
                            <option value="INACTIVE">นำเข้าแบบไม่เปิดใช้งาน</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">
                        รายการ
                        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </label>
                </div>

                <div className="rounded-lg border border-border-subtle bg-surface-subtle p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-content-heading">ผู้รับผิดชอบ</h3>
                            <p className="mt-1 text-xs text-content-secondary">จาก Excel: {row.data.ownerNames.join(", ") || "ไม่พบชื่อ"}</p>
                        </div>
                        <span className="text-xs text-content-secondary">เลือกแล้ว {selectedEmployeeIds.size} คน</span>
                    </div>
                    <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                        {reference.employees.map((employee) => {
                            const chosen = assignees[employee.id];
                            const inactive = employee.status !== undefined && employee.status !== "ACTIVE" || Boolean(employee.deletedAt);
                            return (
                                <div key={employee.id} className="flex items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2">
                                    <input type="checkbox" checked={Boolean(chosen)} disabled={disabled || (inactive && !chosen)} onChange={() => toggleEmployee(employee.id)} aria-label={`เลือก ${employeeName(employee)}`} />
                                    <span className="min-w-0 flex-1 text-sm text-content-body">{employeeName(employee)}{inactive ? <span className="ml-1 text-xs text-status-danger-foreground">(ไม่พร้อมใช้งาน)</span> : null}</span>
                                    {chosen ? <select className="h-9 max-w-36 rounded-md border border-input bg-background px-2 text-xs" value={chosen} onChange={(event) => setAssignees((current) => ({ ...current, [employee.id]: event.target.value as "OWNER" | "CO_OWNER" }))} aria-label={`บทบาท ${employeeName(employee)}`}><option value="OWNER">หลัก</option><option value="CO_OWNER">ร่วม</option></select> : null}
                                </div>
                            );
                        })}
                    </div>
                    {reference.employees.length === 0 ? <p className="mt-3 text-sm text-content-secondary">ยังไม่มีข้อมูลพนักงานให้เลือก</p> : null}
                </div>

                <RoutineScheduleFields
                    scheduleType={scheduleType}
                    scheduleConfig={scheduleConfig}
                    businessDayPolicy={businessDayPolicy}
                    onScheduleTypeChange={setScheduleType}
                    onScheduleConfigChange={setScheduleConfig}
                    onBusinessDayPolicyChange={setBusinessDayPolicy}
                />
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">กำหนดการจาก Excel / คำอธิบายเพิ่มเติม<Input value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} /></label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">วันเริ่มสัญญา<Input type="date" value={contractStartDate ?? ""} onChange={(event) => setContractStartDate(event.target.value || null)} /></label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">วันสิ้นสุดสัญญา<Input type="date" value={contractEndDate ?? ""} onChange={(event) => setContractEndDate(event.target.value || null)} /></label>
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">ข้อความสัญญา<Input value={contractText ?? ""} onChange={(event) => setContractText(event.target.value || null)} /></label>
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">รายละเอียดเพิ่มเติม<Textarea value={extraDetails ?? ""} onChange={(event) => setExtraDetails(event.target.value || null)} /></label>
                </div>

                <div className="rounded-lg border border-border-subtle bg-surface-subtle p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-content-heading">การแจ้งเตือนล่วงหน้า</h3>
                            <p className="mt-1 text-xs text-content-secondary">ส่งในระบบตามเวลาไทย (Asia/Bangkok) เท่านั้น</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" defaultValue="" onChange={(event) => { applyReminderPreset(event.target.value); event.target.value = ""; }} aria-label="เลือกชุดแจ้งเตือน">
                                <option value="">ใช้ชุดสำเร็จรูป</option>
                                <option value="monthly">รายเดือน: 3 และ 1 วัน</option>
                                <option value="yearly">รายปี: 14, 7 และ 1 วัน</option>
                                <option value="contract">ต่อสัญญา: 30, 7 และ 1 วัน</option>
                            </select>
                            <Button type="button" variant="outline" size="sm" onClick={() => addReminderRule()} disabled={disabled}><BellPlus /> เพิ่มกฎ</Button>
                        </div>
                    </div>
                    {reminderRules.length === 0 ? <p className="mt-3 rounded-md border border-dashed border-border-subtle bg-background px-3 py-3 text-sm text-content-secondary">ยังไม่มีกฎ ระบบจะไม่ส่งการแจ้งเตือนสำหรับแม่แบบนี้</p> : (
                        <div className="mt-3 space-y-2">
                            {reminderRules.map((rule, index) => (
                                <div key={`${index}-${rule.daysBefore}`} className="grid gap-3 rounded-md border border-border-subtle bg-background p-3 md:grid-cols-[110px_110px_1fr_auto_auto] md:items-end">
                                    <label className="grid gap-1 text-xs font-medium text-content-body">ล่วงหน้า (วัน)<Input type="number" min={0} max={365} value={rule.daysBefore} onChange={(event) => updateReminderRule(index, { daysBefore: Number(event.target.value) })} /></label>
                                    <label className="grid gap-1 text-xs font-medium text-content-body">เวลา (น.)<Input type="number" min={0} max={23} value={rule.sendHour} onChange={(event) => updateReminderRule(index, { sendHour: Number(event.target.value) })} /></label>
                                    <label className="grid gap-1 text-xs font-medium text-content-body">ผู้รับการแจ้งเตือน<select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={rule.recipientScope} onChange={(event) => updateReminderRule(index, { recipientScope: event.target.value as RoutineReminderRecipientScope })}>{Object.entries(REMINDER_SCOPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                    <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-content-body"><input type="checkbox" checked={rule.isActive} onChange={(event) => updateReminderRule(index, { isActive: event.target.checked })} /> เปิดใช้</label>
                                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeReminderRule(index)} disabled={disabled} aria-label={`ลบกฎการแจ้งเตือนที่ ${index + 1}`}><Trash2 /></Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <label className="flex items-center gap-3 text-sm font-medium text-content-body">
                    <input type="checkbox" checked={selected} onChange={(event) => setSelected(event.target.checked)} />
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
