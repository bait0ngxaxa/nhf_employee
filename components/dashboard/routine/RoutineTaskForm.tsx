import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";

import type {
    RoutineBusinessDayPolicy,
    RoutineScheduleType,
} from "@/lib/routine/schedule";
import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_DEFAULT_REMINDER_TIME,
    ROUTINE_SCHEDULE_TYPES,
    formatRoutineSendTime,
    getDefaultRoutineScheduleConfig,
    parseRoutineSendTime,
} from "@/lib/routine/schedule";
import {
    addRoutineAssignee,
    normalizeRoutineAssignees,
    removeRoutineAssignee,
    setRoutineAssigneeRole,
} from "@/lib/routine/assignees";
import { createIdempotencyKey } from "@/lib/client/idempotency-key";
import {
    routineTaskCreateSchema,
    routineTaskUpdateSchema,
} from "@/lib/validations/routine";

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
import { formatRoutineUnitLabel, uniqueRoutineUnits } from "./labels";
import type {
    RoutineAssigneeRole,
    RoutineEmployee,
    RoutineReferenceData,
    RoutineTask,
} from "./types";

interface RoutineTaskFormProps {
    reference: RoutineReferenceData;
    initialTask: RoutineTask | null;
    onSaved: () => void;
    onCancel: () => void;
    mode?: "SELF_SERVICE" | "ADMIN";
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
    reminderRules: RoutineReminderRuleForm[];
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

function routineEmployeeName(employee: RoutineEmployee): string {
    return employee.displayName?.trim()
        || `${employee.firstName} ${employee.lastName}`.trim()
        || employee.nickname?.trim()
        || `รหัสพนักงาน ${employee.id}`;
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
            : getDefaultRoutineScheduleConfig(scheduleType),
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

export function RoutineTaskForm({
    reference,
    initialTask,
    onSaved,
    onCancel,
    mode = "ADMIN",
}: RoutineTaskFormProps) {
    const units = uniqueRoutineUnits(reference.units);
    const isSelfService = mode === "SELF_SERVICE";
    const selfEmployee = isSelfService ? reference.employees[0] : undefined;
    const selfServiceAssignees = initialTask
        ? initialTask.assignees
        : selfEmployee
            ? [{ employeeId: selfEmployee.id, role: "OWNER" as const, employee: selfEmployee }]
            : [];
    const hasReassignedSelfServiceTask = Boolean(
        initialTask
        && selfEmployee
        && initialTask.assignees.some((assignee) => assignee.employeeId !== selfEmployee.id),
    );
    const initialAssignees = useMemo(
        () => initialTask?.assignees.length
            ? normalizeRoutineAssignees(Object.fromEntries(initialTask.assignees.map((assignee) => [assignee.employeeId, assignee.role])))
            : selfEmployee
                ? { [selfEmployee.id]: "OWNER" as const }
                : {},
        [initialTask, selfEmployee],
    );
    const [form, setForm] = useState<TaskFormState>(() => taskToForm(initialTask));
    const [assignees, setAssignees] = useState<Record<number, RoutineAssigneeRole>>(
        () => initialAssignees,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reminderPreset, setReminderPreset] = useState<RoutineReminderPreset | "">("");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const initialSnapshot = useMemo(
        () => routineFormSnapshot({ form: taskToForm(initialTask), assignees: initialAssignees }),
        [initialAssignees, initialTask],
    );
    const currentSnapshot = useMemo(
        () => routineFormSnapshot({ form, assignees }),
        [assignees, form],
    );
    const initialSnapshotRef = useRef(initialSnapshot);
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
    const submitLockRef = useRef(false);
    const createIdempotencyKeyRef = useRef<string | null>(null);

    useEffect(() => {
        setForm(taskToForm(initialTask));
        setAssignees(initialAssignees);
        setError(null);
        setFieldErrors({});
        setReminderPreset("");
        initialSnapshotRef.current = initialSnapshot;
        setDiscardConfirmOpen(false);
        createIdempotencyKeyRef.current = initialTask ? null : createIdempotencyKey();
    }, [initialAssignees, initialSnapshot, initialTask]);

    const isDirty = currentSnapshot !== initialSnapshotRef.current;

    function requestCancel(): void {
        if (isSubmitting) return;
        if (isDirty) {
            setDiscardConfirmOpen(true);
            return;
        }
        onCancel();
    }

    function discardChanges(): void {
        setDiscardConfirmOpen(false);
        onCancel();
    }

    function updateField<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]): void {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function toggleEmployee(employeeId: number): void {
        setAssignees((current) => current[employeeId]
            ? removeRoutineAssignee(current, employeeId)
            : addRoutineAssignee(current, employeeId));
    }

    function updateAssigneeRole(employeeId: number, role: RoutineAssigneeRole): void {
        setAssignees((current) => setRoutineAssigneeRole(current, employeeId, role));
    }

    function addReminderRule(daysBefore = 1): void {
        setReminderPreset("");
        setForm((current) => ({
            ...current,
            reminderRules: [
                ...current.reminderRules,
                {
                    daysBefore: String(daysBefore),
                    sendHour: ROUTINE_DEFAULT_REMINDER_TIME,
                    recipientScope: "ASSIGNEES",
                    isActive: true,
                },
            ],
        }));
    }

    function removeReminderRule(index: number): void {
        setReminderPreset("");
        setForm((current) => ({
            ...current,
            reminderRules: current.reminderRules.filter((_, itemIndex) => itemIndex !== index),
        }));
    }

    function updateReminderRule(index: number, patch: Partial<RoutineReminderRuleForm>): void {
        setReminderPreset("");
        setForm((current) => ({
            ...current,
            reminderRules: current.reminderRules.map((rule, itemIndex) =>
                itemIndex === index ? { ...rule, ...patch } : rule,
            ),
        }));
    }

    function applyReminderPreset(preset: RoutineReminderPreset): void {
        const days = getRoutineReminderPresetDays(preset);
        if (days.length === 0) return;
        setReminderPreset(preset);
        setForm((current) => ({
            ...current,
            reminderRules: days.map((daysBefore) => ({
                daysBefore: String(daysBefore),
                sendHour: ROUTINE_DEFAULT_REMINDER_TIME,
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
        if (!isSelfService && ownerCount !== 1) {
            setError("กรุณาเลือกผู้รับผิดชอบหลัก 1 คน");
            setFieldErrors({ assignees: "ต้องมีผู้รับผิดชอบหลัก 1 คน" });
            focusFirstRoutineInvalidField({ assignees: "ต้องมีผู้รับผิดชอบหลัก 1 คน" });
            submitLockRef.current = false;
            return;
        }
        if (isSelfService && !selfEmployee) {
            setError("ไม่พบข้อมูลพนักงานของบัญชีผู้ใช้");
            submitLockRef.current = false;
            return;
        }

        const reminderRules = form.reminderRules.map((rule) => ({
            daysBefore: Number(rule.daysBefore),
            sendHour: parseRoutineSendTime(rule.sendHour),
            channel: "IN_APP" as const,
            recipientScope: isSelfService ? "ASSIGNEES" : rule.recipientScope,
            isActive: rule.isActive,
        }));
        const reminderTimeErrors = getRoutineReminderFieldErrors(form.reminderRules);
        if (Object.keys(reminderTimeErrors).length > 0) {
            setFieldErrors(reminderTimeErrors);
            setError("กรุณาตรวจสอบรูปแบบการแจ้งเตือนในช่องที่มีเครื่องหมายเตือน");
            focusFirstRoutineInvalidField(reminderTimeErrors);
            submitLockRef.current = false;
            return;
        }
        const assigneesPayload = isSelfService
            ? initialTask
                ? undefined
                : selfEmployee
                    ? [{ employeeId: selfEmployee.id, role: "OWNER" as const }]
                    : undefined
            : Object.entries(assignees).map(([employeeId, role]) => ({
                  employeeId: Number(employeeId),
                  role,
              }));
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
            ...(assigneesPayload ? { assignees: assigneesPayload } : {}),
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
            focusFirstRoutineInvalidField(nextErrors);
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
                    focusFirstRoutineInvalidField(serverErrors);
                }
                throw new Error(readError(body));
            }
            toast.success(initialTask ? "บันทึกการแก้ไขสำเร็จ" : "สร้างรายการ Routine สำเร็จ");
            initialSnapshotRef.current = routineFormSnapshot({ form, assignees });
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
            className="space-y-6 rounded-2xl border border-border-subtle bg-surface-raised p-4 sm:p-6"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
            noValidate
        >
            <div className="space-y-1">
                <h3 className="text-xl font-semibold tracking-tight text-content-heading">{initialTask ? (isSelfService ? "แก้ไขแม่แบบงานของฉัน" : "แก้ไขแม่แบบงานประจำ") : (isSelfService ? "สร้างแม่แบบงานของฉัน" : "สร้างแม่แบบงานประจำ")}</h3>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">กำหนดข้อมูลหลัก ตารางงาน ผู้รับผิดชอบ และการแจ้งเตือนในแบบฟอร์มเดียว</p>
            </div>
            {isSelfService ? (
                <div className="rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm leading-6 text-brand-strong">
                    {initialTask ? (
                        <>
                            <p>
                                {hasReassignedSelfServiceTask
                                    ? "ผู้รับผิดชอบของงานนี้ถูกปรับโดยผู้ดูแลระบบ"
                                    : "ผู้รับผิดชอบปัจจุบันของงานนี้เป็นไปตามข้อมูลในระบบ"}
                            </p>
                            <p>การแจ้งเตือนจะส่งทั้งในระบบและอีเมล</p>
                        </>
                    ) : "ผู้รับผิดชอบคือคุณ และการแจ้งเตือนจะส่งทั้งในระบบและอีเมล"}
                </div>
            ) : null}
            {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground" role="alert">{error}</p> : null}
            <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-content-body">หน่วยงาน
                    <select data-routine-field="unitId" aria-invalid={Boolean(fieldErrors.unitId)} className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.unitId} onChange={(event) => updateField("unitId", event.target.value)} disabled={isSubmitting}>
                        <option value="">เลือกหน่วยงาน</option>
                        {units.map((unit) => <option key={unit.id} value={unit.id}>{formatRoutineUnitLabel(unit)}</option>)}
                    </select>
                    {fieldErrors.unitId ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.unitId}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">หมวดหมู่
                    <select data-routine-field="categoryId" aria-invalid={Boolean(fieldErrors.categoryId)} className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} disabled={isSubmitting}>
                        <option value="">เลือกหมวดหมู่</option>
                        {reference.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    {fieldErrors.categoryId ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.categoryId}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">ชื่องาน
                    <Input data-routine-field="title" aria-invalid={Boolean(fieldErrors.title)} value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน" maxLength={255} disabled={isSubmitting} />
                    {fieldErrors.title ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.title}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body md:col-span-2">รายละเอียด
                    <Textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="รายละเอียดหรือขั้นตอนที่จำเป็น" maxLength={5000} disabled={isSubmitting} />
                </label>
            </div>

            <RoutineScheduleFields
                scheduleType={form.scheduleType}
                scheduleConfig={form.scheduleConfig}
                businessDayPolicy={form.businessDayPolicy}
                contractStartDate={form.contractStartDate}
                contractEndDate={form.contractEndDate}
                contractText={form.contractText}
                onScheduleTypeChange={(value) => updateField("scheduleType", value)}
                onScheduleConfigChange={(value) => updateField("scheduleConfig", value)}
                onBusinessDayPolicyChange={(value) => updateField("businessDayPolicy", value)}
                onContractStartDateChange={(value) => updateField("contractStartDate", value)}
                onContractEndDateChange={(value) => updateField("contractEndDate", value)}
                onContractTextChange={(value) => updateField("contractText", value)}
                errors={fieldErrors}
                disabled={isSubmitting}
                allowManual={initialTask !== null}
            />
            <label className="grid gap-1 text-sm font-medium text-content-body">
                คำอธิบายกำหนดการ
                <Input data-routine-field="scheduleText" aria-invalid={Boolean(fieldErrors.scheduleText)} value={form.scheduleText} onChange={(event) => updateField("scheduleText", event.target.value)} placeholder="เช่น ทุกวันที่ 10 ของเดือน" maxLength={500} disabled={isSubmitting} />
                {fieldErrors.scheduleText ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldErrors.scheduleText}</span> : null}
            </label>

            <RoutineReminderFields
                rules={form.reminderRules}
                selectedPreset={reminderPreset}
                errors={fieldErrors}
                disabled={isSubmitting}
                selfService={isSelfService}
                onPresetChange={applyReminderPreset}
                onAddRule={() => addReminderRule()}
                onUpdateRule={updateReminderRule}
                onRemoveRule={removeReminderRule}
            />

            {isSelfService ? (
                <fieldset className="space-y-2 rounded-xl border border-border-subtle bg-surface-subtle p-4 sm:p-5">
                    <legend className="px-1 text-base font-semibold text-content-heading">ผู้รับผิดชอบ</legend>
                    <p className="text-sm leading-6 text-content-secondary">
                        {selfServiceAssignees.length > 0
                            ? selfServiceAssignees
                                .map((assignee) => routineEmployeeName(assignee.employee))
                                .join(", ")
                            : "ไม่พบข้อมูลพนักงานของบัญชีผู้ใช้"}
                    </p>
                </fieldset>
            ) : (
                <RoutineAssigneePicker
                    employees={reference.employees}
                    assignees={assignees}
                    onToggle={toggleEmployee}
                    onRoleChange={updateAssigneeRole}
                    error={fieldErrors.assignees}
                    disabled={isSubmitting}
                />
            )}

            <div>
                <label className="grid gap-1 text-sm font-medium text-content-body">รายละเอียดเพิ่มเติม
                    <Textarea value={form.extraDetails} onChange={(event) => updateField("extraDetails", event.target.value)} maxLength={5000} disabled={isSubmitting} />
                </label>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-content-body"><input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} disabled={isSubmitting} /> เปิดใช้งานแม่แบบงานนี้</label>
            <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={requestCancel} disabled={isSubmitting}>ยกเลิก</Button>
                <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} aria-live="polite">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            กำลังบันทึก…
                        </>
                    ) : isSelfService ? "บันทึกงานของฉัน" : "บันทึกแม่แบบงาน"}
                </Button>
            </div>
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
        </form>
    );
}
