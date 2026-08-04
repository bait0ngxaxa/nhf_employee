import { useEffect, useMemo, useRef, useState } from "react";
import { BellPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";

import type {
    RoutineBusinessDayPolicy,
    RoutineScheduleType,
} from "@/lib/routine/schedule";
import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_SCHEDULE_TYPES,
    formatRoutineSendTime,
    parseRoutineSendTime,
} from "@/lib/routine/schedule";
import { createIdempotencyKey } from "@/lib/client/idempotency-key";
import {
    routineTaskCreateSchema,
    routineTaskUpdateSchema,
} from "@/lib/validations/routine";

import { RoutineScheduleFields } from "./RoutineScheduleFields";
import type {
    RoutineAssigneeRole,
    RoutineReferenceData,
    RoutineReminderRecipientScope,
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
    scheduleType: RoutineScheduleType;
    scheduleConfig: Record<string, unknown>;
    scheduleText: string;
    contractStartDate: string;
    contractEndDate: string;
    contractText: string;
    extraDetails: string;
    businessDayPolicy: RoutineBusinessDayPolicy;
    isActive: boolean;
    reminderRules: ReminderRuleForm[];
}

interface ReminderRuleForm {
    daysBefore: string;
    sendHour: string;
    recipientScope: RoutineReminderRecipientScope;
    isActive: boolean;
}

const REMINDER_SCOPE_LABELS: Record<RoutineReminderRecipientScope, string> = {
    ASSIGNEES: "ผู้รับผิดชอบ",
    ADMINS: "ผู้ดูแลระบบ",
    ASSIGNEES_AND_ADMINS: "ผู้รับผิดชอบและผู้ดูแลระบบ",
};

const REMINDER_PRESETS: Record<string, number[]> = {
    monthly: [3, 1],
    yearly: [14, 7, 1],
    contract: [30, 7, 1],
};

function defaultScheduleConfig(scheduleType: RoutineScheduleType): Record<string, unknown> {
    switch (scheduleType) {
        case "MONTHLY_DAY":
            return { day: 10, monthOffset: 0 };
        case "MONTH_END":
            return {};
        case "INTERVAL_MONTHS":
            return { intervalMonths: 3, anchorDate: "2026-01-01" };
        case "YEARLY_DATE":
            return { month: 3, day: 31 };
        case "ONE_TIME":
            return { date: "2026-07-21" };
        case "MANUAL":
            return {};
    }
}

function isRoutineScheduleType(value: string): value is RoutineScheduleType {
    return ROUTINE_SCHEDULE_TYPES.includes(value as RoutineScheduleType);
}

function isRoutineBusinessDayPolicy(value: string): value is RoutineBusinessDayPolicy {
    return ROUTINE_BUSINESS_DAY_POLICIES.includes(value as RoutineBusinessDayPolicy);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dateInputValue(value: string | null | undefined): string {
    return value ? value.slice(0, 10) : "";
}

function taskToForm(task: RoutineTask | null): TaskFormState {
    const scheduleType = task && isRoutineScheduleType(task.scheduleType)
        ? task.scheduleType
        : "MONTHLY_DAY";
    const businessDayPolicy = task && isRoutineBusinessDayPolicy(task.businessDayPolicy)
        ? task.businessDayPolicy
        : "NONE";
    return {
        unitId: task ? String(task.unitId) : "",
        categoryId: task ? String(task.categoryId) : "",
        title: task?.title ?? "",
        description: task?.description ?? "",
        scheduleType,
        scheduleConfig: task && isObject(task.scheduleConfig)
            ? task.scheduleConfig
            : defaultScheduleConfig(scheduleType),
        scheduleText: task?.scheduleText ?? "",
        contractStartDate: dateInputValue(task?.contractStartDate),
        contractEndDate: dateInputValue(task?.contractEndDate),
        contractText: task?.contractText ?? "",
        extraDetails: task?.extraDetails ?? "",
        businessDayPolicy,
        isActive: task?.isActive ?? true,
        reminderRules: task?.reminderRules?.map((rule) => ({
            daysBefore: String(rule.daysBefore),
            sendHour: formatRoutineSendTime(rule.sendHour),
            recipientScope: rule.recipientScope,
            isActive: rule.isActive,
        })) ?? [],
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

function validationErrors(value: unknown): Record<string, string> {
    if (!isObject(value) || !isObject(value.details)) return {};
    return Object.entries(value.details).reduce<Record<string, string>>(
        (errors, [path, messages]) => {
            if (Array.isArray(messages) && typeof messages[0] === "string") {
                errors[path] = messages[0];
            }
            return errors;
        },
        {},
    );
}

function focusFirstInvalidField(errors: Record<string, string>): void {
    const firstPath = Object.keys(errors)[0];
    if (!firstPath || typeof document === "undefined") return;
    window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(
            `[data-routine-field="${firstPath}"]`,
        )?.focus();
    });
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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const submitLockRef = useRef(false);
    const createIdempotencyKeyRef = useRef<string | null>(null);

    useEffect(() => {
        setForm(taskToForm(initialTask));
        setAssignees(
            Object.fromEntries(initialTask?.assignees.map((assignee) => [assignee.employeeId, assignee.role]) ?? []) as Record<number, RoutineAssigneeRole>,
        );
        setError(null);
        setFieldErrors({});
        createIdempotencyKeyRef.current = initialTask ? null : createIdempotencyKey();
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

    function addReminderRule(daysBefore = 1): void {
        setForm((current) => ({
            ...current,
            reminderRules: [
                ...current.reminderRules,
                {
                    daysBefore: String(daysBefore),
                    sendHour: "09:00",
                    recipientScope: "ASSIGNEES",
                    isActive: true,
                },
            ],
        }));
    }

    function removeReminderRule(index: number): void {
        setForm((current) => ({
            ...current,
            reminderRules: current.reminderRules.filter((_, itemIndex) => itemIndex !== index),
        }));
    }

    function updateReminderRule<K extends keyof ReminderRuleForm>(
        index: number,
        key: K,
        value: ReminderRuleForm[K],
    ): void {
        setForm((current) => ({
            ...current,
            reminderRules: current.reminderRules.map((rule, itemIndex) =>
                itemIndex === index ? { ...rule, [key]: value } : rule,
            ),
        }));
    }

    function applyReminderPreset(preset: string): void {
        const days = REMINDER_PRESETS[preset];
        if (!days) return;
        setForm((current) => ({
            ...current,
            reminderRules: days.map((daysBefore) => ({
                daysBefore: String(daysBefore),
                sendHour: "09:00",
                recipientScope: "ASSIGNEES",
                isActive: true,
            })),
        }));
    }

    async function submit(): Promise<void> {
        if (submitLockRef.current || isSubmitting) return;
        submitLockRef.current = true;
        setError(null);
        setFieldErrors({});
        const ownerCount = Object.values(assignees).filter((role) => role === "OWNER").length;
        if (ownerCount !== 1) {
            setError("กรุณาเลือกผู้รับผิดชอบหลัก 1 คน");
            setFieldErrors({ assignees: "ต้องมีผู้รับผิดชอบหลัก 1 คน" });
            submitLockRef.current = false;
            return;
        }

        const reminderRules = form.reminderRules.map((rule) => ({
            daysBefore: Number(rule.daysBefore),
            sendHour: parseRoutineSendTime(rule.sendHour),
            channel: "IN_APP" as const,
            recipientScope: rule.recipientScope,
            isActive: rule.isActive,
        }));
        const reminderTimeErrors = form.reminderRules.reduce<Record<string, string>>(
            (errors, rule, index) => {
                if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.sendHour)) {
                    errors[`reminderRules.${index}.sendHour`] = "ระบุเวลาในรูปแบบ HH:mm";
                } else if (parseRoutineSendTime(rule.sendHour) === null) {
                    errors[`reminderRules.${index}.sendHour`] = "ระบบรองรับเฉพาะเวลาเต็มชั่วโมง เช่น 09:00";
                }
                if (!/^\d+$/.test(rule.daysBefore)) {
                    errors[`reminderRules.${index}.daysBefore`] = "ระบุจำนวนวันเป็นจำนวนเต็ม";
                }
                return errors;
            },
            {},
        );
        if (Object.keys(reminderTimeErrors).length > 0) {
            setFieldErrors(reminderTimeErrors);
            focusFirstInvalidField(reminderTimeErrors);
            submitLockRef.current = false;
            return;
        }
        const payload = {
            unitId: Number(form.unitId),
            categoryId: Number(form.categoryId),
            title: form.title,
            description: form.description || null,
            scheduleType: form.scheduleType,
            scheduleConfig: form.scheduleConfig,
            scheduleText: form.scheduleText || null,
            contractStartDate: form.contractStartDate || null,
            contractEndDate: form.contractEndDate || null,
            contractText: form.contractText || null,
            extraDetails: form.extraDetails || null,
            businessDayPolicy: form.businessDayPolicy,
            isActive: form.isActive,
            reminderRules: reminderRules.map((rule) => ({
                ...rule,
                sendHour: rule.sendHour ?? -1,
            })),
            assignees: Object.entries(assignees).map(([employeeId, role]) => ({
                employeeId: Number(employeeId),
                role,
            })),
            ...(initialTask ? { version: initialTask.version } : {}),
        };
        const parsed = initialTask
            ? routineTaskUpdateSchema.safeParse(payload)
            : routineTaskCreateSchema.safeParse(payload);
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
            setError("กรุณาตรวจสอบข้อมูลในช่องที่มีเครื่องหมายเตือน");
            focusFirstInvalidField(nextErrors);
            submitLockRef.current = false;
            return;
        }

        setIsSubmitting(true);
        try {
            const headers: Record<string, string> = {
                "content-type": "application/json",
            };
            if (!initialTask) {
                const idempotencyKey = createIdempotencyKeyRef.current ?? createIdempotencyKey();
                createIdempotencyKeyRef.current = idempotencyKey;
                headers["idempotency-key"] = idempotencyKey;
            }
            const response = await fetch(
                initialTask
                    ? API_ROUTES.routines.taskById(initialTask.id)
                    : API_ROUTES.routines.tasks,
                {
                    method: initialTask ? "PATCH" : "POST",
                    headers,
                    body: JSON.stringify(parsed.data),
                },
            );
            const body: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                const serverErrors = validationErrors(body);
                if (Object.keys(serverErrors).length > 0) {
                    setFieldErrors(serverErrors);
                    focusFirstInvalidField(serverErrors);
                }
                throw new Error(readError(body));
            }
            toast.success(initialTask ? "บันทึกการแก้ไขสำเร็จ" : "สร้างรายการ Routine สำเร็จ");
            onSaved();
        } catch (submitError) {
            const message = submitError instanceof Error
                ? submitError.message
                : "บันทึกข้อมูลไม่สำเร็จ";
            setError(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
            submitLockRef.current = false;
        }
    }

    return (
        <form
            className="space-y-5 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-6"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
            noValidate
        >
            <div>
                <h3 className="text-lg font-semibold text-content-heading">{initialTask ? "แก้ไขแม่แบบงานประจำ" : "สร้างแม่แบบงานประจำ"}</h3>
                <p className="mt-1 text-sm text-content-secondary">ผู้ใช้จะเห็น 1 รายการต่อ 1 งาน ระบบจัดเก็บรอบแจ้งเตือนภายในตามกำหนดการปัจจุบันและล่วงหน้า 2 เดือน</p>
            </div>
            {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">{error}</p> : null}
            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-content-body">หน่วยงาน
                    <select data-routine-field="unitId" aria-invalid={Boolean(fieldErrors.unitId)} className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.unitId} onChange={(event) => updateField("unitId", event.target.value)}>
                        <option value="">เลือกหน่วยงาน</option>
                        {reference.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
                    </select>
                    {fieldErrors.unitId ? <span className="text-xs text-status-danger-foreground">{fieldErrors.unitId}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">หมวดหมู่
                    <select data-routine-field="categoryId" aria-invalid={Boolean(fieldErrors.categoryId)} className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                        <option value="">เลือกหมวดหมู่</option>
                        {reference.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    {fieldErrors.categoryId ? <span className="text-xs text-status-danger-foreground">{fieldErrors.categoryId}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">ชื่องาน
                    <Input data-routine-field="title" aria-invalid={Boolean(fieldErrors.title)} value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน" />
                    {fieldErrors.title ? <span className="text-xs text-status-danger-foreground">{fieldErrors.title}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">รายละเอียด
                    <Textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="รายละเอียดหรือขั้นตอนที่จำเป็น" />
                </label>
            </div>

            <RoutineScheduleFields
                scheduleType={form.scheduleType}
                scheduleConfig={form.scheduleConfig}
                businessDayPolicy={form.businessDayPolicy}
                onScheduleTypeChange={(value) => updateField("scheduleType", value)}
                onScheduleConfigChange={(value) => updateField("scheduleConfig", value)}
                onBusinessDayPolicyChange={(value) => updateField("businessDayPolicy", value)}
                errors={fieldErrors}
            />
            <label className="grid gap-1 text-sm font-medium text-content-body">
                คำอธิบายกำหนดการ
                <Input value={form.scheduleText} onChange={(event) => updateField("scheduleText", event.target.value)} placeholder="เช่น ทุกวันที่ 10 ของเดือน" />
            </label>

            <fieldset className="space-y-3 rounded-lg border border-border-subtle bg-surface-subtle p-4">
                <legend className="px-1 text-sm font-semibold text-content-heading">การแจ้งเตือนล่วงหน้า</legend>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="mt-1 text-xs text-content-secondary">ตรวจตามเวลาไทย (Asia/Bangkok) และส่งผ่านการแจ้งเตือนในระบบเท่านั้น</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                            defaultValue=""
                            onChange={(event) => {
                                applyReminderPreset(event.target.value);
                                event.target.value = "";
                            }}
                            aria-label="เลือกชุดกฎการแจ้งเตือน"
                        >
                            <option value="">ใช้ชุดสำเร็จรูป</option>
                            <option value="monthly">งานรายเดือน: 3 และ 1 วัน</option>
                            <option value="yearly">งานรายปี: 14, 7 และ 1 วัน</option>
                            <option value="contract">งานต่อสัญญา: 30, 7 และ 1 วัน</option>
                        </select>
                        <Button type="button" variant="outline" size="sm" onClick={() => addReminderRule()}>
                            <BellPlus />
                            เพิ่มกฎ
                        </Button>
                    </div>
                </div>
                {form.reminderRules.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border-subtle bg-background px-3 py-3 text-sm text-content-secondary">
                        ยังไม่มีกฎ ระบบจะไม่ส่งการแจ้งเตือนสำหรับแม่แบบนี้
                    </p>
                ) : (
                    <div className="space-y-2">
                        {form.reminderRules.map((rule, index) => (
                            <div key={`${index}-${rule.daysBefore}`} className="grid gap-3 rounded-md border border-border-subtle bg-background p-3 md:grid-cols-[110px_110px_1fr_auto_auto] md:items-end">
                                <label className="grid gap-1 text-xs font-medium text-content-body">
                                    ล่วงหน้า (วัน)
                                    <Input
                                        data-routine-field={`reminderRules.${index}.daysBefore`}
                                        aria-invalid={Boolean(fieldErrors[`reminderRules.${index}.daysBefore`])}
                                        type="number"
                                        min={0}
                                        max={365}
                                        value={rule.daysBefore}
                                        onChange={(event) => updateReminderRule(index, "daysBefore", event.target.value)}
                                    />
                                    {fieldErrors[`reminderRules.${index}.daysBefore`] ? <span className="text-xs text-status-danger-foreground">{fieldErrors[`reminderRules.${index}.daysBefore`]}</span> : null}
                                </label>
                                <label className="grid gap-1 text-xs font-medium text-content-body">
                                    เวลาแจ้งเตือน (Asia/Bangkok)
                                    <Input
                                        data-routine-field={`reminderRules.${index}.sendHour`}
                                        aria-invalid={Boolean(fieldErrors[`reminderRules.${index}.sendHour`])}
                                        type="time"
                                        step={3600}
                                        min="00:00"
                                        max="23:00"
                                        value={rule.sendHour}
                                        onChange={(event) => updateReminderRule(index, "sendHour", event.target.value)}
                                    />
                                    {fieldErrors[`reminderRules.${index}.sendHour`] ? <span className="text-xs text-status-danger-foreground">{fieldErrors[`reminderRules.${index}.sendHour`]}</span> : null}
                                </label>
                                <label className="grid gap-1 text-xs font-medium text-content-body">
                                    ผู้รับการแจ้งเตือน
                                    <select
                                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                                        value={rule.recipientScope}
                                        onChange={(event) => updateReminderRule(index, "recipientScope", event.target.value as RoutineReminderRecipientScope)}
                                    >
                                        {Object.entries(REMINDER_SCOPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-content-body">
                                    <input
                                        type="checkbox"
                                        checked={rule.isActive}
                                        onChange={(event) => updateReminderRule(index, "isActive", event.target.checked)}
                                    />
                                    เปิดใช้
                                </label>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeReminderRule(index)} aria-label={`ลบกฎการแจ้งเตือนที่ ${index + 1}`}>
                                    <Trash2 />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
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
                {fieldErrors.assignees ? <p className="text-xs text-status-danger-foreground">{fieldErrors.assignees}</p> : null}
            </fieldset>

            <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1 text-sm font-medium text-content-body">วันเริ่มสัญญา
                    <Input data-routine-field="contractStartDate" aria-invalid={Boolean(fieldErrors.contractStartDate)} type="date" value={form.contractStartDate} onChange={(event) => updateField("contractStartDate", event.target.value)} />
                    {fieldErrors.contractStartDate ? <span className="text-xs text-status-danger-foreground">{fieldErrors.contractStartDate}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">วันสิ้นสุดสัญญา
                    <Input data-routine-field="contractEndDate" aria-invalid={Boolean(fieldErrors.contractEndDate)} type="date" value={form.contractEndDate} onChange={(event) => updateField("contractEndDate", event.target.value)} />
                    {fieldErrors.contractEndDate ? <span className="text-xs text-status-danger-foreground">{fieldErrors.contractEndDate}</span> : null}
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
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "กำลังบันทึก..." : "บันทึกแม่แบบงาน"}</Button>
            </div>
        </form>
    );
}
