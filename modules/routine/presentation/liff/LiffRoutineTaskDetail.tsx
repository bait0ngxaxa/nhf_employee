"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { CalendarClock, Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetScrollArea,
    SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/helpers/date-helpers";
import {
    formatRoutineDueLabel,
    formatRoutineScheduleSummary,
    formatRoutineUnitLabel,
    getRoutineTimingStatusClass,
    ROUTINE_BUSINESS_DAY_POLICY_LABELS,
    ROUTINE_SCHEDULE_LABELS,
    ROUTINE_TIMING_STATUS_LABELS,
} from "../dashboard/labels";
import type {
    LiffRoutineTaskDetail as LiffRoutineTaskDetailData,
} from "./api";
import type { LiffRoutineTaskDetailOccurrence } from "./types";

import { LiffRoutineDeleteConfirm } from "./LiffRoutineDeleteConfirm";

interface LiffRoutineTaskDetailProps {
    open: boolean;
    detail: LiffRoutineTaskDetailData | null;
    loading: boolean;
    error: string | null;
    deleting: boolean;
    deleteError: string | null;
    focusedOccurrenceId?: number | null;
    onOpenChange: (open: boolean) => void;
    onRetry: () => void;
    onEdit: (task: LiffRoutineTaskDetailData) => void;
    onDelete: (task: LiffRoutineTaskDetailData) => void;
}

function DetailRow({
    label,
    value,
    multiline = false,
}: {
    label: string;
    value: string;
    multiline?: boolean;
}): ReactElement {
    return (
        <div>
            <dt className="text-xs font-semibold leading-5 text-content-muted">{label}</dt>
            <dd className={`mt-0.5 break-words text-sm leading-6 text-content-body ${multiline ? "whitespace-pre-wrap" : ""}`}>
                {value}
            </dd>
        </div>
    );
}

function TimingBadge({ occurrence }: { occurrence: LiffRoutineTaskDetailOccurrence }): ReactElement {
    return (
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold leading-5 ${getRoutineTimingStatusClass(occurrence.timingStatus)}`}>
            {ROUTINE_TIMING_STATUS_LABELS[occurrence.timingStatus]}
        </span>
    );
}

function currentOccurrence(
    task: Pick<LiffRoutineTaskDetailData, "id" | "occurrences">,
    focusedOccurrenceId: number | null,
): LiffRoutineTaskDetailOccurrence | null {
    if (focusedOccurrenceId !== null) {
        const focusedOccurrence = task.occurrences.find((occurrence) =>
            occurrence.id === focusedOccurrenceId
            && occurrence.taskId === task.id,
        );
        if (focusedOccurrence) return focusedOccurrence;
    }

    return task.occurrences.find((occurrence) => occurrence.daysUntilDue >= 0) ?? null;
}

function OptionalSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: ReactNode;
}): ReactElement {
    return (
        <section
            className="space-y-3 border-t border-border-subtle pt-5 first:border-t-0 first:pt-0"
            aria-labelledby={id}
        >
            <h3 id={id} className="text-base font-bold text-content-heading">
                {title}
            </h3>
            {children}
        </section>
    );
}

export function LiffRoutineTaskDetail({
    open,
    detail,
    loading,
    error,
    deleting,
    deleteError,
    focusedOccurrenceId = null,
    onOpenChange,
    onRetry,
    onEdit,
    onDelete,
}: LiffRoutineTaskDetailProps): ReactElement {
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const timing = detail ? currentOccurrence(detail, focusedOccurrenceId) : null;

    useEffect(() => {
        setDeleteConfirmOpen(false);
    }, [detail?.id]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                scrollMode="area"
                closeButtonLabel="ปิดรายละเอียดงาน Routine"
                className="h-[94vh] max-h-[94vh] supports-[height:100dvh]:h-[94dvh] supports-[height:100dvh]:max-h-[94dvh] gap-0 rounded-t-xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2"
            >
                <SheetHeader className="shrink-0 border-b border-border-subtle bg-surface px-5 pb-4 pt-5 pr-16 text-left sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="break-words text-xl font-bold leading-7 tracking-tight text-content-heading">
                                {detail?.title ?? "รายละเอียดงาน Routine"}
                            </SheetTitle>
                            <SheetDescription className="mt-1 break-words leading-6 text-content-secondary">
                                {detail
                                    ? `${formatRoutineUnitLabel(detail.unit)} · ${detail.category.name}`
                                    : "ตรวจสอบกำหนดการ รายละเอียด และรอบงาน"}
                            </SheetDescription>
                        </div>
                        {detail?.isActive === false ? (
                            <span className="shrink-0 rounded-full border border-border-subtle bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary">
                                ปิดใช้งาน
                            </span>
                        ) : null}
                    </div>
                </SheetHeader>

                <SheetScrollArea className="bg-surface-subtle px-4 py-5 pb-5 sm:px-6">
                    <div className="mx-auto max-w-2xl space-y-4">
                        {loading ? (
                            <div
                                role="status"
                                aria-live="polite"
                                className="flex min-h-64 items-center justify-center gap-2 border-y border-border-subtle bg-surface p-4 text-sm font-medium text-content-secondary"
                            >
                                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                                กำลังโหลดรายละเอียดงาน...
                            </div>
                        ) : error ? (
                            <div
                                role="alert"
                                className="space-y-4 rounded-md border border-status-danger-border bg-status-danger-surface p-5 text-sm leading-6 text-status-danger-foreground"
                            >
                                <p>{error}</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11 border-status-danger-border bg-surface text-status-danger-foreground"
                                    onClick={onRetry}
                                >
                                    โหลดรายละเอียดอีกครั้ง
                                </Button>
                            </div>
                        ) : detail ? (
                            <>
                                {timing ? (
                                    <section className="space-y-3 rounded-md border border-brand-border bg-brand-surface p-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
                                            <CalendarClock className="size-4" aria-hidden="true" />
                                            รอบที่เกี่ยวข้อง
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-lg font-bold text-content-heading">
                                                {formatDate(timing.dueDate)}
                                            </p>
                                            <TimingBadge occurrence={timing} />
                                        </div>
                                        <p className="text-sm leading-6 text-brand-strong">
                                            {formatRoutineDueLabel(timing)}
                                        </p>
                                    </section>
                                ) : null}

                                <OptionalSection id="liff-routine-info" title="ข้อมูลหลัก">
                                    <dl className="grid gap-4 sm:grid-cols-2">
                                        <DetailRow label="หน่วยงาน" value={formatRoutineUnitLabel(detail.unit)} />
                                        <DetailRow label="หมวดหมู่" value={detail.category.name} />
                                        <DetailRow
                                            label="รายละเอียด"
                                            value={detail.description || "ไม่ได้ระบุ"}
                                            multiline
                                        />
                                        <DetailRow
                                            label="สถานะงาน"
                                            value={detail.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                        />
                                    </dl>
                                </OptionalSection>

                                <OptionalSection id="liff-routine-schedule" title="กำหนดการ">
                                    <dl className="space-y-4">
                                        <DetailRow
                                            label="รูปแบบการเกิดงาน"
                                            value={ROUTINE_SCHEDULE_LABELS[detail.scheduleType] ?? detail.scheduleType}
                                        />
                                        <DetailRow
                                            label="สรุปตารางงาน"
                                            value={formatRoutineScheduleSummary({
                                                scheduleType: detail.scheduleType,
                                                scheduleConfig: detail.scheduleConfig,
                                                businessDayPolicy: detail.businessDayPolicy,
                                            })}
                                        />
                                        {detail.scheduleText ? (
                                            <DetailRow label="คำอธิบายกำหนดการ" value={detail.scheduleText} multiline />
                                        ) : null}
                                        <DetailRow
                                            label="การเลื่อนวันทำการ"
                                            value={ROUTINE_BUSINESS_DAY_POLICY_LABELS[detail.businessDayPolicy] ?? detail.businessDayPolicy}
                                        />
                                    </dl>
                                </OptionalSection>

                                {detail.contractStartDate || detail.contractEndDate || detail.contractText ? (
                                    <OptionalSection id="liff-routine-contract" title="ช่วงสัญญา">
                                        <dl className="grid gap-4 sm:grid-cols-2">
                                            {detail.contractStartDate ? (
                                                <DetailRow label="วันเริ่มสัญญา" value={formatDate(detail.contractStartDate)} />
                                            ) : null}
                                            {detail.contractEndDate ? (
                                                <DetailRow label="วันสิ้นสุดสัญญา" value={formatDate(detail.contractEndDate)} />
                                            ) : null}
                                            {detail.contractText ? (
                                                <DetailRow label="ข้อความช่วงสัญญา" value={detail.contractText} multiline />
                                            ) : null}
                                        </dl>
                                    </OptionalSection>
                                ) : null}

                                {detail.extraDetails ? (
                                    <OptionalSection id="liff-routine-extra-details" title="รายละเอียดเพิ่มเติม">
                                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-content-body">
                                            {detail.extraDetails}
                                        </p>
                                    </OptionalSection>
                                ) : null}

                                {detail.canEdit ? (
                                    <OptionalSection id="liff-routine-reminders" title="การแจ้งเตือน">
                                        {detail.reminderRules.length === 0 ? (
                                            <p className="text-sm leading-6 text-content-secondary">
                                                ยังไม่ได้ตั้งการแจ้งเตือนล่วงหน้า
                                            </p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {detail.reminderRules.map((rule, index) => (
                                                    <li
                                                        key={`${rule.daysBefore}-${rule.sendHour}-${index}`}
                                                        className="border-t border-border-subtle py-3 text-sm leading-6 first:border-t-0"
                                                    >
                                                        <span className="font-semibold text-content-heading">
                                                            {rule.daysBefore === 0
                                                                ? "วันครบกำหนด"
                                                                : `ล่วงหน้า ${rule.daysBefore} วัน`}
                                                        </span>
                                                        <span className="text-content-secondary"> · เวลา {String(rule.sendHour).padStart(2, "0")}:00 น.</span>
                                                        {!rule.isActive ? (
                                                            <span className="text-content-muted"> · ปิดใช้งาน</span>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </OptionalSection>
                                ) : null}

                                <OptionalSection id="liff-routine-occurrences" title="รอบงานและกำหนดส่ง">
                                    {detail.occurrences.length === 0 ? (
                                        <p className="text-sm leading-6 text-content-secondary">
                                            ยังไม่มีรอบงานที่สร้างไว้
                                        </p>
                                    ) : (
                                        <ol className="divide-y divide-border-subtle border-y border-border-subtle">
                                            {detail.occurrences.map((occurrence, index) => (
                                                <li
                                                    key={occurrence.id}
                                                    className="py-3 first:pt-3 last:pb-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-content-muted">รอบที่ {index + 1}</p>
                                                            <p className="mt-0.5 break-words text-sm font-bold leading-6 text-content-heading">
                                                                {formatDate(occurrence.dueDate)}
                                                            </p>
                                                        </div>
                                                        <TimingBadge occurrence={occurrence} />
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-content-secondary">
                                                        {formatRoutineDueLabel(occurrence)}
                                                        {occurrence.originalDueDate !== occurrence.dueDate
                                                            ? ` · เดิม ${formatDate(occurrence.originalDueDate)}`
                                                            : ""}
                                                    </p>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </OptionalSection>
                            </>
                        ) : null}
                    </div>
                </SheetScrollArea>

                {(detail?.canEdit || detail?.canDelete) && !loading && !error ? (
                    <div className="shrink-0 border-t border-border-subtle bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
                        <div className="mx-auto grid max-w-2xl gap-2">
                            {detail?.canEdit ? (
                                <Button
                                    type="button"
                                    className="min-h-12 bg-brand-solid font-bold text-content-on-brand hover:bg-brand-solid-hover"
                                    onClick={() => onEdit(detail)}
                                    disabled={deleting}
                                >
                                    <Pencil className="size-4" aria-hidden="true" />
                                    แก้ไขงาน
                                </Button>
                            ) : null}
                            {detail?.canDelete ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11 border-status-danger-border text-status-danger-foreground hover:bg-status-danger-surface"
                                    onClick={() => setDeleteConfirmOpen(true)}
                                    disabled={deleting}
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                    ลบงานนี้
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {detail ? (
                    <LiffRoutineDeleteConfirm
                        open={deleteConfirmOpen}
                        taskTitle={detail.title}
                        busy={deleting}
                        error={deleteError}
                        onOpenChange={setDeleteConfirmOpen}
                        onConfirm={() => onDelete(detail)}
                    />
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
