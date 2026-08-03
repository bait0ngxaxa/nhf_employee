import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";

import { ROUTINE_SCHEDULE_LABELS } from "./labels";
import type {
    RoutineAssigneeRole,
    RoutineReferenceData,
    RoutineTask,
} from "./types";

interface RoutineTaskFormProps {
    reference: RoutineReferenceData;
    initialTask: RoutineTask | null;
    onSaved: () => void;
    onCancel: () => void;
}

interface TaskFormState {
    unitId: string;
    categoryId: string;
    title: string;
    description: string;
    scheduleType: string;
    scheduleConfig: string;
    scheduleText: string;
    contractStartDate: string;
    contractEndDate: string;
    contractText: string;
    extraDetails: string;
    businessDayPolicy: string;
    isActive: boolean;
}

function defaultScheduleConfig(scheduleType: string): string {
    switch (scheduleType) {
        case "MONTHLY_DAY":
            return '{\n  "day": 10,\n  "monthOffset": 0\n}';
        case "MONTH_END":
            return "{}";
        case "INTERVAL_MONTHS":
            return '{\n  "intervalMonths": 3,\n  "anchorDate": "2026-01-01"\n}';
        case "YEARLY_DATE":
            return '{\n  "month": 3,\n  "day": 31\n}';
        case "ONE_TIME":
            return '{\n  "date": "2026-07-21"\n}';
        case "MANUAL":
            return "{}";
        default:
            return "{}";
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function taskToForm(task: RoutineTask | null): TaskFormState {
    const scheduleType = task?.scheduleType ?? "MONTHLY_DAY";
    return {
        unitId: task ? String(task.unitId) : "",
        categoryId: task ? String(task.categoryId) : "",
        title: task?.title ?? "",
        description: task?.description ?? "",
        scheduleType,
        scheduleConfig: task && isObject(task.scheduleConfig)
            ? JSON.stringify(task.scheduleConfig, null, 2)
            : defaultScheduleConfig(scheduleType),
        scheduleText: task?.scheduleText ?? "",
        contractStartDate: task?.contractStartDate ?? "",
        contractEndDate: task?.contractEndDate ?? "",
        contractText: task?.contractText ?? "",
        extraDetails: task?.extraDetails ?? "",
        businessDayPolicy: task?.businessDayPolicy ?? "NONE",
        isActive: task?.isActive ?? true,
    };
}

function employeeName(employee: { firstName: string; lastName: string; nickname?: string | null }): string {
    const name = `${employee.firstName} ${employee.lastName}`.trim();
    return employee.nickname ? `${name} (${employee.nickname})` : name;
}

function readError(value: unknown): string {
    if (isObject(value) && typeof value.error === "string") return value.error;
    return "บันทึกข้อมูลไม่สำเร็จ";
}

export function RoutineTaskForm({
    reference,
    initialTask,
    onSaved,
    onCancel,
}: RoutineTaskFormProps) {
    const [form, setForm] = useState<TaskFormState>(() => taskToForm(initialTask));
    const [assignees, setAssignees] = useState<Record<number, RoutineAssigneeRole>>(
        () => Object.fromEntries(initialTask?.assignees.map((assignee) => [assignee.employeeId, assignee.role]) ?? []) as Record<number, RoutineAssigneeRole>,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm(taskToForm(initialTask));
        setAssignees(
            Object.fromEntries(initialTask?.assignees.map((assignee) => [assignee.employeeId, assignee.role]) ?? []) as Record<number, RoutineAssigneeRole>,
        );
        setError(null);
    }, [initialTask]);

    const selectedEmployeeIds = useMemo(
        () => new Set(Object.keys(assignees).map(Number)),
        [assignees],
    );

    function updateField<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]): void {
        setForm((current) => ({ ...current, [key]: value }));
    }

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

    async function submit(): Promise<void> {
        setError(null);
        let scheduleConfig: unknown;
        try {
            scheduleConfig = JSON.parse(form.scheduleConfig) as unknown;
        } catch {
            setError("กำหนดค่า schedule config ต้องเป็น JSON ที่ถูกต้อง");
            return;
        }
        if (!isObject(scheduleConfig)) {
            setError("กำหนดค่า schedule config ต้องเป็น object");
            return;
        }
        const ownerCount = Object.values(assignees).filter((role) => role === "OWNER").length;
        if (ownerCount !== 1) {
            setError("กรุณาเลือกผู้รับผิดชอบหลัก 1 คน");
            return;
        }
        if (!form.unitId || !form.categoryId || !form.title.trim()) {
            setError("กรุณากรอกหน่วยงาน หมวดหมู่ และชื่องาน");
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                unitId: Number(form.unitId),
                categoryId: Number(form.categoryId),
                title: form.title,
                description: form.description || null,
                scheduleType: form.scheduleType,
                scheduleConfig,
                scheduleText: form.scheduleText || null,
                contractStartDate: form.contractStartDate || null,
                contractEndDate: form.contractEndDate || null,
                contractText: form.contractText || null,
                extraDetails: form.extraDetails || null,
                businessDayPolicy: form.businessDayPolicy,
                isActive: form.isActive,
                assignees: Object.entries(assignees).map(([employeeId, role]) => ({
                    employeeId: Number(employeeId),
                    role,
                })),
                ...(initialTask ? { version: initialTask.version } : {}),
            };
            const response = await fetch(
                initialTask
                    ? API_ROUTES.routines.taskById(initialTask.id)
                    : API_ROUTES.routines.tasks,
                {
                    method: initialTask ? "PATCH" : "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(payload),
                },
            );
            const body: unknown = await response.json().catch(() => null);
            if (!response.ok) throw new Error(readError(body));
            onSaved();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="space-y-5 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-6">
            <div>
                <h3 className="text-lg font-semibold text-content-heading">{initialTask ? "แก้ไขแม่แบบงานประจำ" : "สร้างแม่แบบงานประจำ"}</h3>
                <p className="mt-1 text-sm text-content-secondary">ระบบจะสร้างงานตามช่วงเวลาที่กำหนดในเดือนปัจจุบันและล่วงหน้า 2 เดือน</p>
            </div>
            {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">{error}</p> : null}
            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-content-body">หน่วยงาน
                    <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.unitId} onChange={(event) => updateField("unitId", event.target.value)}>
                        <option value="">เลือกหน่วยงาน</option>
                        {reference.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
                    </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">หมวดหมู่
                    <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                        <option value="">เลือกหมวดหมู่</option>
                        {reference.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">ชื่องาน
                    <Input value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">รายละเอียด
                    <Textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="รายละเอียดหรือขั้นตอนที่จำเป็น" />
                </label>
            </div>

            <fieldset className="space-y-3 rounded-lg border border-border-subtle bg-surface-subtle p-4">
                <legend className="px-1 text-sm font-semibold text-content-heading">ตารางงาน</legend>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">รูปแบบการเกิดงาน
                        <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.scheduleType} onChange={(event) => { updateField("scheduleType", event.target.value); updateField("scheduleConfig", defaultScheduleConfig(event.target.value)); }}>
                            {Object.entries(ROUTINE_SCHEDULE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">การเลื่อนวันทำการ
                        <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.businessDayPolicy} onChange={(event) => updateField("businessDayPolicy", event.target.value)}>
                            <option value="NONE">ไม่เลื่อนวัน</option>
                            <option value="PREVIOUS_BUSINESS_DAY">เลื่อนเป็นวันทำการก่อนหน้า</option>
                            <option value="NEXT_BUSINESS_DAY">เลื่อนเป็นวันทำการถัดไป</option>
                        </select>
                    </label>
                    <p className="text-xs text-content-secondary md:col-span-2">ระยะนี้เลื่อนเฉพาะเสาร์–อาทิตย์ ยังไม่รวมวันหยุดนักขัตฤกษ์</p>
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">Schedule config (JSON)
                        <Textarea className="min-h-32 font-mono text-xs" value={form.scheduleConfig} onChange={(event) => updateField("scheduleConfig", event.target.value)} />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">คำอธิบายกำหนดการ
                        <Input value={form.scheduleText} onChange={(event) => updateField("scheduleText", event.target.value)} placeholder="เช่น ทุกวันที่ 10 ของเดือน" />
                    </label>
                </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-border-subtle bg-surface-subtle p-4">
                <legend className="px-1 text-sm font-semibold text-content-heading">ผู้รับผิดชอบ</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {reference.employees.map((employee) => {
                        const selected = selectedEmployeeIds.has(employee.id);
                        return (
                            <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-background px-3 py-2">
                                <input type="checkbox" checked={selected} onChange={() => toggleEmployee(employee.id)} aria-label={`เลือก ${employeeName(employee)}`} />
                                <span className="min-w-0 flex-1 text-sm text-content-body">{employeeName(employee)}</span>
                                {selected ? <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={assignees[employee.id]} onChange={(event) => setAssignees((current) => ({ ...current, [employee.id]: event.target.value as RoutineAssigneeRole }))} aria-label={`บทบาท ${employeeName(employee)}`}><option value="OWNER">ผู้รับผิดชอบหลัก</option><option value="CO_OWNER">ผู้ร่วมรับผิดชอบ</option></select> : null}
                            </div>
                        );
                    })}
                </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1 text-sm font-medium text-content-body">วันเริ่มสัญญา
                    <Input type="date" value={form.contractStartDate} onChange={(event) => updateField("contractStartDate", event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">วันสิ้นสุดสัญญา
                    <Input type="date" value={form.contractEndDate} onChange={(event) => updateField("contractEndDate", event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">ข้อความช่วงสัญญา
                    <Input value={form.contractText} onChange={(event) => updateField("contractText", event.target.value)} placeholder="เช่น สัญญาปีงบประมาณ" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-3">รายละเอียดเพิ่มเติม
                    <Textarea value={form.extraDetails} onChange={(event) => updateField("extraDetails", event.target.value)} />
                </label>
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-content-body"><input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} /> เปิดใช้งานแม่แบบงานนี้</label>
            <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>ยกเลิก</Button>
                <Button type="button" onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "กำลังบันทึก..." : "บันทึกแม่แบบงาน"}</Button>
            </div>
        </div>
    );
}
