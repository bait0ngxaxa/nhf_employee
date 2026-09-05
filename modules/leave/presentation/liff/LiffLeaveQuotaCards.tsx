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
            <div className="grid grid-cols-3 gap-2.5">
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
    const ratio = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;

    return (
        <article
            className={cn(
                "min-w-0 rounded-2xl border px-3 py-3.5 shadow-sm",
                type === "SICK" && "border-status-danger-border-subtle bg-status-danger-surface",
                type === "PERSONAL" && "border-status-info-border-subtle bg-status-info-surface",
                type === "VACATION" && "border-module-leave-badge-border bg-module-leave-badge-surface",
            )}
        >
            <p className="min-h-10 text-xs font-semibold leading-5 text-content-secondary">
                {getLeaveTypeLabel(type)}
            </p>
            <p className="mt-1 tabular-nums text-2xl font-bold tracking-tight text-content-heading">
                {formatLeaveDays(remaining)}
            </p>
            <p className="text-[11px] font-medium leading-4 text-content-muted">วันคงเหลือ</p>
            <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface/80"
                aria-label={`ใช้แล้ว ${formatLeaveDays(used)} จาก ${formatLeaveDays(total)} วัน`}
            >
                <div
                    className="h-full rounded-full bg-module-leave-solid transition-[width]"
                    style={{ width: `${ratio}%` }}
                />
            </div>
            <p className="mt-1.5 text-[10px] font-medium leading-4 text-content-muted">
                ใช้แล้ว {formatLeaveDays(used)} วัน
            </p>
        </article>
    );
}
