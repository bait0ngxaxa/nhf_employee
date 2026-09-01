"use client";

import {
    forwardRef,
    useCallback,
    useMemo,
    useRef,
    useState,
    useImperativeHandle,
    type ReactElement,
} from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
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
import { SheetScrollArea } from "@/components/ui/sheet";
import {
    isRecoveredLiffMutation,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LiffApiError,
} from "@/lib/client/liff";
import {
    createLiffRoutineTask,
    updateLiffRoutineTask,
    type LiffRoutineReferenceData,
    type LiffRoutineTaskDetail,
    type LiffRoutineTaskCreateInput,
    type LiffRoutineTaskUpdateInput,
} from "@/lib/client/liff-routine";
import { createIdempotencyKey } from "@/lib/client/idempotency-key";
import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_DEFAULT_REMINDER_TIME,
    ROUTINE_SCHEDULE_TYPES,
    formatRoutineSendTime,
    getDefaultRoutineScheduleConfig,
    parseRoutineSendTime,
    type RoutineBusinessDayPolicy,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";
import {
    liffRoutineTaskCreateSchema,
    liffRoutineTaskUpdateSchema,
} from "@/lib/validations/line-routine";

import { RoutineReminderFields } from "@/components/dashboard/routine/RoutineReminderFields";
import {
    getRoutineReminderFieldErrors,
    getRoutineReminderPresetDays,
    type RoutineReminderPreset,
    type RoutineReminderRuleForm,
} from "@/components/dashboard/routine/RoutineReminderFields";
import { RoutineScheduleFields } from "@/components/dashboard/routine/RoutineScheduleFields";
import { focusFirstRoutineInvalidField } from "@/components/dashboard/routine/focus-invalid-field";
import { routineFormSnapshot } from "@/components/dashboard/routine/form-dirty-state";
import { formatRoutineUnitLabel, uniqueRoutineUnits } from "@/components/dashboard/routine/labels";

export type LiffRoutineTaskFormMode = "CREATE" | "EDIT";

interface LiffRoutineTaskFormProps {
    mode: LiffRoutineTaskFormMode;
    reference: LiffRoutineReferenceData;
    task: LiffRoutineTaskDetail | null;
    onCancel: () => void;
    onSaved: (
        task: LiffRoutineTaskDetail,
        mode: LiffRoutineTaskFormMode,
    ) => void | Promise<void>;
    onReloadLatest?: (taskId: number) => Promise<LiffRoutineTaskDetail>;
    onAmbiguousSubmit?: (
        mode: LiffRoutineTaskFormMode,
    ) => void | Promise<void>;
}

export interface LiffRoutineTaskFormHandle {
    requestClose: () => void;
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
    reminderRules: RoutineReminderRuleForm[];
}

const STALE_CONFLICT_MESSAGE =
    "งาน Routine นี้ถูกเปลี่ยนแปลงแล้ว ระบบโหลดข้อมูลล่าสุดให้แล้ว กรุณาตรวจสอบก่อนบันทึกอีกครั้ง";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRoutineScheduleType(value: string): value is RoutineScheduleType {
    return ROUTINE_SCHEDULE_TYPES.includes(value as RoutineScheduleType);
}

function isRoutineBusinessDayPolicy(value: string): value is RoutineBusinessDayPolicy {
    return ROUTINE_BUSINESS_DAY_POLICIES.includes(value as RoutineBusinessDayPolicy);
}

function dateInputValue(value: string | null | undefined): string {
    return value ? value.slice(0, 10) : "";
}

function safeReminderSendTime(sendHour: number): string {
    try {
        return formatRoutineSendTime(sendHour);
    } catch {
        return ROUTINE_DEFAULT_REMINDER_TIME;
    }
}

function taskToForm(task: LiffRoutineTaskDetail | null): TaskFormState {
    const scheduleType = task && isRoutineScheduleType(task.scheduleType)
        ? task.scheduleType
        : "MONTHLY_DAY";
    const businessDayPolicy = task && isRoutineBusinessDayPolicy(task.businessDayPolicy)
        ? task.businessDayPolicy
        : "NONE";

    return {
        unitId: task ? String(task.unit.id) : "",
        categoryId: task ? String(task.category.id) : "",
        title: task?.title ?? "",
        description: task?.description ?? "",
        scheduleType,
        scheduleConfig: task && isRecord(task.scheduleConfig)
            ? task.scheduleConfig
            : getDefaultRoutineScheduleConfig(scheduleType),
        scheduleText: task?.scheduleText ?? "",
        contractStartDate: dateInputValue(task?.contractStartDate),
        contractEndDate: dateInputValue(task?.contractEndDate),
        contractText: task?.contractText ?? "",
        extraDetails: task?.extraDetails ?? "",
        businessDayPolicy,
        reminderRules: task?.reminderRules.map((rule) => ({
            daysBefore: String(rule.daysBefore),
            sendHour: safeReminderSendTime(rule.sendHour),
            recipientScope: "ASSIGNEES",
            isActive: rule.isActive,
        })) ?? [],
    };
}

function validationErrors(value: unknown): Record<string, string> {
    if (!isRecord(value)) return {};
    const candidate = isRecord(value.details) ? value.details : value;
    return Object.entries(candidate).reduce<Record<string, string>>(
        (errors, [path, messages]) => {
            if (Array.isArray(messages) && typeof messages[0] === "string") {
                errors[path] = messages[0];
            }
            return errors;
        },
        {},
    );
}

function getErrorFieldMessages(error: unknown): Record<string, string> {
    return error instanceof LiffApiError ? validationErrors(error.details) : {};
}

function getMutationErrorMessage(error: unknown): string {
    if (error instanceof LiffApiError) return error.message;
    return "บันทึกงาน Routine ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

function buildFormPayload(
    form: TaskFormState,
    mode: LiffRoutineTaskFormMode,
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
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
        reminderRules: form.reminderRules.map((rule) => ({
            daysBefore: Number(rule.daysBefore),
            sendHour: parseRoutineSendTime(rule.sendHour) ?? -1,
            channel: "IN_APP" as const,
            recipientScope: "ASSIGNEES" as const,
            isActive: rule.isActive,
        })),
    };

    return mode === "CREATE"
        ? { ...payload, isActive: true }
        : payload;
}

function FieldError({ message }: { message?: string }): ReactElement | null {
    return message ? (
        <span className="text-sm font-normal leading-5 text-status-danger-foreground" role="alert">
            {message}
        </span>
    ) : null;
}

export const LiffRoutineTaskForm = forwardRef<
    LiffRoutineTaskFormHandle,
    LiffRoutineTaskFormProps
>(function LiffRoutineTaskForm({
    mode,
    reference,
    task,
    onCancel,
    onSaved,
    onReloadLatest,
    onAmbiguousSubmit,
}, ref): ReactElement {
    const formTask = mode === "EDIT" ? task : null;
    const units = useMemo(
        () => uniqueRoutineUnits(reference.units),
        [reference.units],
    );
    const [form, setForm] = useState<TaskFormState>(() => taskToForm(formTask));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReloadingLatest, setIsReloadingLatest] = useState(false);
    const [reminderPreset, setReminderPreset] = useState<RoutineReminderPreset | "">("");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
    const [hasConflict, setHasConflict] = useState(false);
    const [latestConflictTask, setLatestConflictTask] = useState<LiffRoutineTaskDetail | null>(null);
    const initialSnapshotRef = useRef(routineFormSnapshot(taskToForm(formTask)));
    const versionRef = useRef<number | null>(formTask?.version ?? null);
    const submitLockRef = useRef(false);
    const createIdempotencyKeyRef = useRef<string | null>(null);

    const currentSnapshot = useMemo(
        () => routineFormSnapshot(form),
        [form],
    );
    const isDirty = currentSnapshot !== initialSnapshotRef.current;
    const controlsDisabled = isSubmitting || isReloadingLatest;

    const requestClose = useCallback((): void => {
        if (controlsDisabled) return;
        if (isDirty) {
            setDiscardConfirmOpen(true);
            return;
        }
        onCancel();
    }, [controlsDisabled, isDirty, onCancel]);

    useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

    const updateField = useCallback(<K extends keyof TaskFormState>(
        key: K,
        value: TaskFormState[K],
    ): void => {
        setForm((current) => ({ ...current, [key]: value }));
    }, []);

    const addReminderRule = useCallback((daysBefore = 1): void => {
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
    }, []);

    const removeReminderRule = useCallback((index: number): void => {
        setReminderPreset("");
        setForm((current) => ({
            ...current,
            reminderRules: current.reminderRules.filter((_, itemIndex) => itemIndex !== index),
        }));
    }, []);

    const updateReminderRule = useCallback((
        index: number,
        patch: Partial<RoutineReminderRuleForm>,
    ): void => {
        setReminderPreset("");
        setForm((current) => ({
            ...current,
            reminderRules: current.reminderRules.map((rule, itemIndex) =>
                itemIndex === index ? { ...rule, ...patch } : rule,
            ),
        }));
    }, []);

    const applyReminderPreset = useCallback((preset: RoutineReminderPreset): void => {
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
    }, []);

    const reloadLatest = useCallback(async (
        message: string = STALE_CONFLICT_MESSAGE,
    ): Promise<void> => {
        if (mode !== "EDIT" || !task || !onReloadLatest || isReloadingLatest) return;
        setIsReloadingLatest(true);
        try {
            const latest = await onReloadLatest(task.id);
            setLatestConflictTask(latest);
            setError(message);
        } catch (reloadError) {
            setError(
                `${message} แต่ยังโหลดข้อมูลล่าสุดไม่ได้ กรุณาลองโหลดอีกครั้ง`,
            );
            toast.error(getMutationErrorMessage(reloadError));
        } finally {
            setIsReloadingLatest(false);
        }
    }, [isReloadingLatest, mode, onReloadLatest, task]);

    function applyLatestTask(): void {
        if (!latestConflictTask) return;
        const nextForm = taskToForm(latestConflictTask);
        setForm(nextForm);
        versionRef.current = latestConflictTask.version;
        initialSnapshotRef.current = routineFormSnapshot(nextForm);
        setLatestConflictTask(null);
        setHasConflict(false);
        setError(null);
        setFieldErrors({});
        setReminderPreset("");
    }

    async function submit(): Promise<void> {
        if (submitLockRef.current || isSubmitting || hasConflict) return;
        submitLockRef.current = true;
        setError(null);
        setFieldErrors({});

        const reminderErrors = getRoutineReminderFieldErrors(form.reminderRules);
        if (Object.keys(reminderErrors).length > 0) {
            setFieldErrors(reminderErrors);
            setError("กรุณาตรวจสอบรูปแบบการแจ้งเตือนในช่องที่มีเครื่องหมายเตือน");
            focusFirstRoutineInvalidField(reminderErrors);
            submitLockRef.current = false;
            return;
        }

        if (mode === "EDIT" && (!task || versionRef.current === null)) {
            setError("ไม่พบเวอร์ชันของงาน Routine กรุณาปิดแล้วเปิดรายละเอียดใหม่");
            submitLockRef.current = false;
            return;
        }

        const basePayload = buildFormPayload(form, mode);
        const candidate = mode === "EDIT"
            ? { ...basePayload, version: versionRef.current }
            : basePayload;
        const parsed = mode === "EDIT"
            ? liffRoutineTaskUpdateSchema.safeParse(candidate)
            : liffRoutineTaskCreateSchema.safeParse(candidate);

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
            let savedTask: LiffRoutineTaskDetail;
            if (mode === "EDIT" && task) {
                const updatePayload = parsed.data as LiffRoutineTaskUpdateInput;
                const response = await updateLiffRoutineTask(task.id, updatePayload);
                savedTask = response.task;
                toast.success("บันทึกการแก้ไข Routine สำเร็จ");
            } else {
                const createPayload = parsed.data as LiffRoutineTaskCreateInput;
                const idempotencyKey = createIdempotencyKeyRef.current
                    ?? createIdempotencyKey();
                createIdempotencyKeyRef.current = idempotencyKey;
                const response = await createLiffRoutineTask(createPayload, idempotencyKey);
                savedTask = response.task;
                toast.success(
                    response.replayed
                        ? "ยืนยันงาน Routine ที่สร้างไว้แล้ว"
                        : "สร้าง Routine ของฉันสำเร็จ",
                );
            }
            await onSaved(savedTask, mode);
        } catch (submitError) {
            const serverErrors = getErrorFieldMessages(submitError);
            if (Object.keys(serverErrors).length > 0) {
                setFieldErrors(serverErrors);
                focusFirstRoutineInvalidField(serverErrors);
            }

            if (isRecoveredLiffMutation(submitError)) {
                if (mode === "EDIT" && task && onReloadLatest) {
                    setHasConflict(true);
                    setLatestConflictTask(null);
                    try {
                        await reloadLatest(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                    } catch {
                        // reloadLatest has already surfaced the recoverable reload error.
                    }
                } else {
                    try {
                        await onAmbiguousSubmit?.(mode);
                    } catch {
                        // The form keeps its payload and idempotency key for explicit retry.
                    }
                    setError(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                }
                toast.error(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                return;
            }

            if (mode === "EDIT"
                && submitError instanceof LiffApiError
                && submitError.status === 409) {
                setHasConflict(true);
                setLatestConflictTask(null);
                setError(STALE_CONFLICT_MESSAGE);
                try {
                    await reloadLatest();
                } catch {
                    // reloadLatest has already surfaced the recoverable reload error.
                }
            } else {
                const message = getMutationErrorMessage(submitError);
                setError(message);
                toast.error(message);
            }
        } finally {
            setIsSubmitting(false);
            submitLockRef.current = false;
        }
    }

    function discardChanges(): void {
        setDiscardConfirmOpen(false);
        onCancel();
    }

    return (
        <form
            className="flex min-h-0 flex-1 flex-col bg-surface-subtle"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
            noValidate
        >
            <SheetScrollArea className="scroll-pb-6">
                <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:px-6">
                    <section className="space-y-4">
                        <h2 className="text-base font-bold text-content-heading">ข้อมูลหลัก</h2>
                        <div className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm leading-6 text-brand-strong">
                            <p className="font-semibold">
                                {mode === "CREATE"
                                    ? "งานนี้จะเป็นของคุณโดยอัตโนมัติ"
                                    : "คุณกำลังแก้ไขงานที่คุณสร้างไว้"}
                            </p>
                            <p className="mt-1">
                                การแจ้งเตือนจะส่งให้ผู้รับผิดชอบของคุณตามกฎที่ตั้งไว้
                            </p>
                        </div>

                        {error && !hasConflict ? (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        ) : null}

                        {hasConflict ? (
                            <div
                                role="alert"
                                className="space-y-3 rounded-xl border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong"
                            >
                                <div className="flex items-start gap-2">
                                    <RefreshCw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    <p>{error ?? STALE_CONFLICT_MESSAGE}</p>
                                </div>
                                <p>
                                    ร่างที่คุณกำลังแก้ไขยังอยู่ในแบบฟอร์ม จะยังไม่ถูกแทนที่จนกว่าจะเลือกใช้ข้อมูลล่าสุด
                                </p>
                                {latestConflictTask ? (
                                    <div className="rounded-lg border border-status-warning-border/80 bg-surface/70 px-3 py-2 leading-6">
                                        ข้อมูลล่าสุด: “{latestConflictTask.title}”
                                    </div>
                                ) : null}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11 border-status-warning-border bg-surface text-status-warning-strong hover:bg-status-warning-surface"
                                    disabled={isReloadingLatest}
                                    onClick={() => {
                                        if (latestConflictTask) {
                                            applyLatestTask();
                                        } else {
                                            void reloadLatest();
                                        }
                                    }}
                                >
                                    {isReloadingLatest ? (
                                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <RefreshCw className="size-4" aria-hidden="true" />
                                    )}
                                    {latestConflictTask
                                        ? "ใช้ข้อมูลล่าสุดและแก้ไขต่อ"
                                        : "โหลดข้อมูลล่าสุด"}
                                </Button>
                            </div>
                        ) : null}

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-1.5 text-sm font-semibold text-content-body">
                                <span>หน่วยงาน</span>
                                <select
                                    data-routine-field="unitId"
                                    aria-invalid={Boolean(fieldErrors.unitId)}
                                    className="h-12 min-w-0 rounded-md border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    value={form.unitId}
                                    disabled={controlsDisabled}
                                    onChange={(event) => updateField("unitId", event.target.value)}
                                >
                                    <option value="">เลือกหน่วยงาน</option>
                                    {units.map((unit) => (
                                        <option key={unit.id} value={unit.id}>
                                            {formatRoutineUnitLabel(unit)}
                                        </option>
                                    ))}
                                </select>
                                <FieldError message={fieldErrors.unitId} />
                            </label>

                            <label className="grid gap-1.5 text-sm font-semibold text-content-body">
                                <span>หมวดหมู่</span>
                                <select
                                    data-routine-field="categoryId"
                                    aria-invalid={Boolean(fieldErrors.categoryId)}
                                    className="h-12 min-w-0 rounded-md border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    value={form.categoryId}
                                    disabled={controlsDisabled}
                                    onChange={(event) => updateField("categoryId", event.target.value)}
                                >
                                    <option value="">เลือกหมวดหมู่</option>
                                    {reference.categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <FieldError message={fieldErrors.categoryId} />
                            </label>

                            <label className="grid gap-1.5 text-sm font-semibold text-content-body md:col-span-2">
                                <span>ชื่องาน</span>
                                <Input
                                    data-routine-field="title"
                                    aria-invalid={Boolean(fieldErrors.title)}
                                    value={form.title}
                                    onChange={(event) => updateField("title", event.target.value)}
                                    placeholder="เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"
                                    maxLength={255}
                                    disabled={controlsDisabled}
                                    className="h-12 text-base"
                                />
                                <FieldError message={fieldErrors.title} />
                            </label>

                            <label className="grid gap-1.5 text-sm font-semibold text-content-body md:col-span-2">
                                <span>รายละเอียด</span>
                                <Textarea
                                    data-routine-field="description"
                                    aria-invalid={Boolean(fieldErrors.description)}
                                    value={form.description}
                                    onChange={(event) => updateField("description", event.target.value)}
                                    placeholder="รายละเอียดหรือขั้นตอนที่จำเป็น"
                                    maxLength={5000}
                                    disabled={controlsDisabled}
                                    className="min-h-24 text-base leading-6"
                                />
                                <FieldError message={fieldErrors.description} />
                            </label>
                        </div>
                    </section>

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
                        disabled={controlsDisabled}
                        allowManual
                        variant="embedded"
                    />

                    <section className="space-y-3 border-t border-border-subtle pt-5">
                        <h2 className="text-base font-bold text-content-heading">คำอธิบายกำหนดการ</h2>
                        <label className="grid gap-1.5 text-sm font-semibold text-content-body">
                            <span>คำอธิบายกำหนดการ</span>
                            <Input
                                data-routine-field="scheduleText"
                                aria-invalid={Boolean(fieldErrors.scheduleText)}
                                value={form.scheduleText}
                                onChange={(event) => updateField("scheduleText", event.target.value)}
                                placeholder="เช่น ทุกวันที่ 10 ของเดือน"
                                maxLength={500}
                                disabled={controlsDisabled}
                                className="h-12 text-base"
                            />
                            <FieldError message={fieldErrors.scheduleText} />
                        </label>
                    </section>

                    <RoutineReminderFields
                        rules={form.reminderRules}
                        selectedPreset={reminderPreset}
                        errors={fieldErrors}
                        disabled={controlsDisabled}
                        selfService
                        onPresetChange={applyReminderPreset}
                        onAddRule={() => addReminderRule()}
                        onUpdateRule={updateReminderRule}
                        onRemoveRule={removeReminderRule}
                        variant="embedded"
                    />

                    <section className="space-y-3 border-t border-border-subtle pt-5">
                        <h2 className="text-base font-bold text-content-heading">รายละเอียดเพิ่มเติม</h2>
                        <label className="grid gap-1.5 text-sm font-semibold text-content-body">
                            <span>รายละเอียดเพิ่มเติม</span>
                            <Textarea
                                data-routine-field="extraDetails"
                                aria-invalid={Boolean(fieldErrors.extraDetails)}
                                value={form.extraDetails}
                                onChange={(event) => updateField("extraDetails", event.target.value)}
                                maxLength={5000}
                                disabled={controlsDisabled}
                                className="min-h-24 text-base leading-6"
                            />
                            <FieldError message={fieldErrors.extraDetails} />
                        </label>
                    </section>
                </div>
            </SheetScrollArea>

            <div className="shrink-0 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-border-subtle bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
                <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={controlsDisabled}
                    onClick={requestClose}
                >
                    ยกเลิก
                </Button>
                <Button
                    type="submit"
                    className="min-h-12 bg-brand-solid font-bold text-content-on-brand hover:bg-brand-solid-hover"
                    disabled={controlsDisabled || hasConflict}
                    aria-busy={isSubmitting}
                    aria-live="polite"
                >
                    {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : null}
                    {isSubmitting
                        ? "กำลังบันทึก..."
                        : mode === "CREATE"
                            ? "เพิ่ม Routine ของฉัน"
                            : "บันทึกการแก้ไข"}
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
});
