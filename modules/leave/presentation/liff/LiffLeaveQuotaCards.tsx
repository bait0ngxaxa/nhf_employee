import type { ReactElement } from "react";

import type { LiffLeaveQuotaSummary, LeaveTypeValue } from "../types";
import { cn } from "@/lib/ui/utils";

import { formatLeaveDays, getLeaveTypeLabel } from "./leave-format";

const LEAVE_TYPES: LeaveTypeValue[] = ["SICK", "PERSONAL", "VACATION"];

interface LiffLeaveQuotaCardsProps {
    quotas: LiffLeaveQuotaSummary[];
}

export function LiffLeaveQuotaCards({
    quotas,
}: LiffLeaveQuotaCardsProps): ReactElement {
    return (
        <section aria-labelledby="liff-leave-quota-heading" className="space-y-3">
            <div>
                <h2
                    id="liff-leave-quota-heading"
                    className="text-lg font-bold tracking-tight text-content-heading"
                >
                    สิทธิ์วันลาของฉัน
                </h2>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    ยอดคงเหลือตามสิทธิ์ปีปัจจุบัน
                </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border-subtle border-y border-border-subtle">
                {LEAVE_TYPES.map((type) => (
                    <QuotaCard
                        key={type}
                        type={type}
                        quota={quotas.find((item) => item.leaveType === type)}
                    />
                ))}
            </div>
        </section>
    );
}

function QuotaCard({
    type,
    quota,
}: {
    type: LeaveTypeValue;
    quota: LiffLeaveQuotaSummary | undefined;
}): ReactElement {
    const remaining = quota?.remainingDays ?? 0;
    const used = quota?.usedDays ?? 0;
    const total = quota?.effectiveTotalDays ?? 0;
    const progressMax = Math.max(total, used, 1);
    const progressValue = Math.min(used, progressMax);
    const ratio = Math.min(100, Math.max(0, (progressValue / progressMax) * 100));
    const labelClassName = type === "SICK"
        ? "text-status-danger-strong"
        : type === "PERSONAL"
            ? "text-status-info-strong"
            : "text-module-leave-badge-foreground";

    return (
        <article
            className="min-w-0 px-2.5 py-3.5 first:pl-0 last:pr-0"
        >
            <p className={cn("min-h-10 text-xs font-semibold leading-5", labelClassName)}>
                {getLeaveTypeLabel(type)}
            </p>
            <p className="mt-1 tabular-nums text-2xl font-bold tracking-tight text-content-heading">
                {formatLeaveDays(remaining)}
            </p>
            <p className="text-[11px] font-medium leading-4 text-content-muted">วันคงเหลือ</p>
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progressMax}
                aria-valuenow={progressValue}
                aria-valuetext={`ใช้แล้ว ${formatLeaveDays(used)} จาก ${formatLeaveDays(total)} วัน`}
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                aria-label={`ใช้แล้ว ${formatLeaveDays(used)} จาก ${formatLeaveDays(total)} วัน`}
            >
                <div
                    className="h-full rounded-full bg-module-leave-solid"
                    style={{ width: `${ratio}%` }}
                />
            </div>
            <p className="mt-1.5 text-xs font-medium leading-4 text-content-muted">
                ใช้แล้ว {formatLeaveDays(used)} วัน
            </p>
        </article>
    );
}
