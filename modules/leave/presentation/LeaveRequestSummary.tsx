"use client";

import { useId, type ReactElement } from "react";

import type { LeaveRequestValues } from "../schemas/leave";

type LeaveTypeValue = LeaveRequestValues["leaveType"];

export interface LeaveRequestSummaryProps {
    leaveType: LeaveTypeValue;
    requestedDays: number;
    remainingQuota: number | null;
    projectedRemainingQuota: number | null;
    overQuotaDays: number;
    isDateRangeValid: boolean;
}

const LEAVE_TYPE_LABELS: Readonly<Record<LeaveTypeValue, string>> = {
    SICK: "ลาป่วย",
    PERSONAL: "ลากิจ",
    VACATION: "ลาพักร้อน",
};

const leaveDayFormatter = new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 1,
});

function formatDays(value: number): string {
    return leaveDayFormatter.format(value) + " วัน";
}

function SummaryItem({
    label,
    value,
    isWarning = false,
}: {
    label: string;
    value: string;
    isWarning?: boolean;
}): ReactElement {
    return (
        <div className="min-w-0 space-y-1">
            <dt className="text-xs leading-5 text-content-secondary">{label}</dt>
            <dd
                className={
                    isWarning
                        ? "break-words font-semibold tabular-nums text-status-warning-foreground"
                        : "break-words font-semibold tabular-nums text-content-heading"
                }
                aria-live="polite"
                aria-atomic="true"
            >
                {value}
            </dd>
        </div>
    );
}

export function LeaveRequestSummary({
    leaveType,
    requestedDays,
    remainingQuota,
    projectedRemainingQuota,
    overQuotaDays,
    isDateRangeValid,
}: LeaveRequestSummaryProps): ReactElement {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="space-y-3 rounded-xl border border-border-subtle bg-surface-neutral-subtle p-4"
        >
            <h3 id={headingId} className="font-semibold text-content-heading">
                สรุปคำขอลา
            </h3>
            <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                <SummaryItem
                    label="ประเภทการลา"
                    value={LEAVE_TYPE_LABELS[leaveType]}
                />
                <SummaryItem
                    label="ระยะเวลาที่ขอ"
                    value={isDateRangeValid ? formatDays(requestedDays) : "ตรวจสอบวันที่ลา"}
                />
                <SummaryItem
                    label="ยอดคงเหลือก่อนยื่น"
                    value={remainingQuota === null
                        ? "ไม่ทราบยอดคงเหลือของปีที่เลือก"
                        : formatDays(remainingQuota)}
                />
                <SummaryItem
                    label="คงเหลือโดยประมาณหลังคำขอ"
                    value={projectedRemainingQuota === null
                        ? "ยังคำนวณไม่ได้"
                        : formatDays(projectedRemainingQuota)}
                    isWarning={projectedRemainingQuota !== null && projectedRemainingQuota < 0}
                />
            </dl>
            {overQuotaDays > 0 ? (
                <div
                    className="rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-2.5 text-sm leading-6 text-status-warning-foreground"
                    role="status"
                    aria-live="polite"
                >
                    <p className="font-semibold">
                        คำขอนี้เกินสิทธิ์ {formatDays(overQuotaDays)}
                    </p>
                    <p>ผู้อนุมัติจะพิจารณาจากเหตุผลพิเศษที่ระบุ</p>
                </div>
            ) : null}
        </section>
    );
}
