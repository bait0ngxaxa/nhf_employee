"use client";

import type { LucideIcon } from "lucide-react";
import {
    BellRing,
    CalendarClock,
    ClipboardList,
    Database,
    ListChecks,
    Users,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    calendarDateToDate,
    formatRoutineSendTime,
} from "../../domain/schedule";

import {
    areRoutineAssigneeSnapshotsEqual,
    formatRoutineAssigneeName,
    formatRoutineScheduleSummary,
    formatRoutineUnitLabel,
    getRoutineTimingStatusClass,
    ROUTINE_ASSIGNEE_ROLE_LABELS,
    ROUTINE_BUSINESS_DAY_POLICY_LABELS,
    ROUTINE_REMINDER_RECIPIENT_SCOPE_LABELS,
    ROUTINE_SCHEDULE_LABELS,
    ROUTINE_TIMING_STATUS_LABELS,
    sortRoutineAssignees,
} from "./labels";
import type {
    RoutineAssignee,
    RoutineTask,
    RoutineTaskWorkItem,
} from "./types";

type RoutineDetailsTask = RoutineTask | RoutineTaskWorkItem;

interface RoutineDetailsDialogProps {
    isAdmin: boolean;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    task: RoutineDetailsTask | null;
}

interface DetailSectionProps {
    children: ReactNode;
    icon: LucideIcon;
    title: string;
}

interface DetailItemProps {
    label: string;
    value: ReactNode;
    wide?: boolean;
}

function DetailSection({ children, icon: Icon, title }: DetailSectionProps): ReactElement {
    return (
        <section className="space-y-4 py-6 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 text-content-heading">
                <Icon className="size-4 text-brand-foreground" aria-hidden="true" />
                <h3 className="text-lg font-semibold leading-7 tracking-tight">{title}</h3>
            </div>
            {children}
        </section>
    );
}

function DetailItem({ label, value, wide = false }: DetailItemProps): ReactElement {
    return (
        <div className={wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
            <dt className="text-xs/5 font-semibold text-content-muted">{label}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-content-body [overflow-wrap:anywhere]">
                {value}
            </dd>
        </div>
    );
}

function optionalText(value: string | null | undefined): string {
    return value?.trim() || "ไม่ได้ระบุ";
}

function formatDate(value: string | null): string {
    if (!value) return "ไม่ได้ระบุ";
    const calendarDate = value.slice(0, 10);
    try {
        return new Intl.DateTimeFormat("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Bangkok",
        }).format(calendarDateToDate(calendarDate));
    } catch {
        return value;
    }
}

function formatReminderLeadTime(daysBefore: number): string {
    if (daysBefore === 0) return "วันครบกำหนด";
    return `${daysBefore} วันก่อนครบกำหนด`;
}

function formatReminderTime(sendHour: number): string {
    return Number.isInteger(sendHour) && sendHour >= 0 && sendHour <= 23
        ? `${formatRoutineSendTime(sendHour)} น.`
        : "ไม่ได้ระบุ";
}

function AssigneeList({ assignees }: { assignees: readonly RoutineAssignee[] }): ReactElement {
    const sortedAssignees = sortRoutineAssignees(assignees);
    if (sortedAssignees.length === 0) {
        return <p className="text-sm leading-6 text-content-secondary">ยังไม่ได้ระบุผู้รับผิดชอบ</p>;
    }

    return (
        <ul className="divide-y divide-border-subtle" aria-label="รายชื่อผู้รับผิดชอบ">
            {sortedAssignees.map((assignee) => (
                <li
                    key={assignee.employeeId}
                    className="flex min-w-0 flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                    <span className="min-w-0 break-words text-sm font-semibold leading-6 text-content-body">
                        {formatRoutineAssigneeName(assignee)}
                    </span>
                    <span className="w-fit shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-content-secondary">
                        {ROUTINE_ASSIGNEE_ROLE_LABELS[assignee.role]}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function hasImportMetadata(task: RoutineDetailsTask): task is RoutineTask {
    return "sourceFileName" in task
        && Boolean(task.sourceFileName || task.sourceSheet || task.sourceRow);
}

export function RoutineDetailsDialog({
    isAdmin,
    onOpenChange,
    open,
    task,
}: RoutineDetailsDialogProps): ReactElement {
    if (!task) return <Dialog open={false} onOpenChange={onOpenChange} />;

    const occurrence = "relevantOccurrence" in task
        ? task.relevantOccurrence
        : null;
    const hasOccurrenceAssigneeOverride = occurrence !== null
        && !areRoutineAssigneeSnapshotsEqual(task.assignees, occurrence.assignees);
    const extraDetails = task.extraDetails?.trim();
    const showImportMetadata = isAdmin && hasImportMetadata(task);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                closeLabel="ปิดรายละเอียด Routine"
                scrollMode="area"
                className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl"
            >
                <DialogHeader className="shrink-0 gap-3 border-b border-border-subtle bg-surface-subtle px-5 py-5 pr-12 text-left sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="max-w-full break-words rounded-full bg-brand-surface px-2.5 py-1 text-xs font-medium text-brand-strong [overflow-wrap:anywhere]">
                            {formatRoutineUnitLabel(task.unit)}
                        </span>
                        <span className="max-w-full break-words rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-content-secondary [overflow-wrap:anywhere]">
                            {task.category.name}
                        </span>
                        <span className={task.isActive
                            ? "rounded-full bg-status-success-surface px-2.5 py-1 text-xs font-semibold text-status-success-foreground"
                            : "rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-content-body"}
                        >
                            {task.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                        </span>
                    </div>
                    <DialogTitle className="break-words pr-2 text-xl font-semibold leading-7 tracking-tight text-content-heading [overflow-wrap:anywhere]">
                        {task.title}
                    </DialogTitle>
                    <DialogDescription className="max-w-[70ch] break-words text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                        รายละเอียดแม่แบบ Routine{occurrence ? " และรอบงานที่เกี่ยวข้อง" : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
                    <div className="divide-y divide-border-subtle">
                        <DetailSection icon={ClipboardList} title="ข้อมูลหลัก">
                            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                <DetailItem label="หน่วยงาน" value={formatRoutineUnitLabel(task.unit)} />
                                <DetailItem label="หมวดหมู่" value={task.category.name} />
                                <DetailItem label="รายละเอียด" value={optionalText(task.description)} wide />
                            </dl>
                        </DetailSection>

                        <DetailSection icon={CalendarClock} title="กำหนดการ">
                            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                <DetailItem
                                    label="รูปแบบการเกิดงาน"
                                    value={ROUTINE_SCHEDULE_LABELS[task.scheduleType] ?? task.scheduleType}
                                />
                                <DetailItem
                                    label="นโยบายวันทำการ"
                                    value={ROUTINE_BUSINESS_DAY_POLICY_LABELS[task.businessDayPolicy]
                                        ?? task.businessDayPolicy}
                                />
                                <DetailItem
                                    label="สรุปกำหนดการ"
                                    value={formatRoutineScheduleSummary(task)}
                                    wide
                                />
                                <DetailItem
                                    label="คำอธิบายกำหนดการ"
                                    value={optionalText(task.scheduleText)}
                                    wide
                                />
                                <DetailItem label="วันเริ่มสัญญา" value={formatDate(task.contractStartDate)} />
                                <DetailItem label="วันสิ้นสุดสัญญา" value={formatDate(task.contractEndDate)} />
                                <DetailItem label="ข้อความช่วงสัญญา" value={optionalText(task.contractText)} wide />
                            </dl>
                        </DetailSection>

                        <DetailSection icon={ListChecks} title="รอบปัจจุบัน / รอบที่เกี่ยวข้อง">
                            {occurrence ? (
                                <div className="space-y-4">
                                        <div className="rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm font-medium leading-6 text-brand-strong">
                                        ข้อมูลในส่วนนี้มีผลเฉพาะรอบ {occurrence.periodKey} และไม่เปลี่ยนแม่แบบ Routine
                                    </div>
                                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                        <DetailItem label="รอบงาน" value={occurrence.periodKey} />
                                        <DetailItem
                                            label="สถานะเวลา"
                                            value={(
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoutineTimingStatusClass(occurrence.timingStatus)}`}>
                                                    {ROUTINE_TIMING_STATUS_LABELS[occurrence.timingStatus]}
                                                </span>
                                            )}
                                        />
                                        <DetailItem label="วันกำหนด" value={formatDate(occurrence.dueDate)} />
                                        {occurrence.originalDueDate !== occurrence.dueDate ? (
                                            <DetailItem label="วันกำหนดเดิม" value={formatDate(occurrence.originalDueDate)} />
                                        ) : null}
                                    </dl>
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="text-sm font-semibold text-content-body">ผู้รับผิดชอบรอบนี้</h4>
                                            {hasOccurrenceAssigneeOverride ? (
                                                <span className="rounded-full border border-status-warning-border bg-status-warning-surface px-2 py-1 text-xs font-medium text-status-warning-foreground">
                                                    ปรับเฉพาะรอบนี้
                                                </span>
                                            ) : null}
                                        </div>
                                        <AssigneeList assignees={occurrence.assignees} />
                                    </div>
                                </div>
                            ) : (
                                <p className="rounded-lg border border-dashed border-border-subtle bg-surface-subtle px-4 py-3 text-sm leading-6 text-content-secondary">
                                    ยังไม่มีรอบกำหนดที่เกี่ยวข้องในขณะนี้
                                </p>
                            )}
                        </DetailSection>

                        <DetailSection icon={Users} title="ผู้รับผิดชอบแม่แบบ Routine">
                            <AssigneeList assignees={task.assignees} />
                        </DetailSection>

                        <DetailSection icon={BellRing} title="การแจ้งเตือนล่วงหน้า">
                            {task.reminderRules.length > 0 ? (
                                <ul className="divide-y divide-border-subtle" aria-label="กฎการแจ้งเตือน">
                                    {task.reminderRules.map((rule) => (
                                        <li
                                            key={rule.id}
                                            className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold leading-6 text-content-body">
                                                    {formatReminderLeadTime(rule.daysBefore)} · {formatReminderTime(rule.sendHour)}
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-content-secondary">
                                                    ส่งถึง {ROUTINE_REMINDER_RECIPIENT_SCOPE_LABELS[rule.recipientScope]}
                                                </p>
                                            </div>
                                            <span className={rule.isActive
                                                ? "w-fit rounded-full bg-status-success-surface px-2.5 py-1 text-xs font-semibold text-status-success-foreground"
                                                : "w-fit rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary"}
                                            >
                                                {rule.isActive ? "เปิดใช้" : "ปิดใช้"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm leading-6 text-content-secondary">ไม่ได้ตั้งกฎการแจ้งเตือน</p>
                            )}
                        </DetailSection>

                        {extraDetails ? (
                            <DetailSection icon={ClipboardList} title="รายละเอียดเพิ่มเติม">
                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-content-body [overflow-wrap:anywhere]">
                                    {extraDetails}
                                </p>
                            </DetailSection>
                        ) : null}

                        {showImportMetadata ? (
                            <DetailSection icon={Database} title="ข้อมูลนำเข้า (ผู้ดูแลระบบ)">
                                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                    <DetailItem label="ไฟล์ต้นทาง" value={optionalText(task.sourceFileName)} />
                                    <DetailItem label="ชีตต้นทาง" value={optionalText(task.sourceSheet)} />
                                    <DetailItem
                                        label="แถวต้นทาง"
                                        value={task.sourceRow === null ? "ไม่ได้ระบุ" : String(task.sourceRow)}
                                    />
                                </dl>
                            </DetailSection>
                        ) : null}
                    </div>
                </div>

                <DialogFooter className="shrink-0 border-t border-border-subtle bg-surface-subtle px-5 py-4 sm:px-6">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">ปิด</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
