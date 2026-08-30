import { Card, CardContent } from "@/components/ui/card";
import type { LeaveQuotaBalance } from "@/hooks/useLeaveProfile";
import { cn } from "@/lib/ui/utils";

interface LeaveQuotaCardsProps {
    sickQuota: LeaveQuotaBalance;
    personalQuota: LeaveQuotaBalance;
    vacationQuota: LeaveQuotaBalance;
}

interface QuotaCardProps {
    title: string;
    remain: number;
    used: number;
    total: number;
    annualTotal: number;
    carryBalance?: number;
    note: string;
    theme: {
        valueColor: string;
        barColor: string;
    };
}

function QuotaCard({
    title,
    remain,
    used,
    total,
    annualTotal,
    carryBalance,
    note,
    theme,
}: QuotaCardProps) {
    const isOverQuota = remain < 0;
    const displayedRemain = isOverQuota ? Math.abs(remain) : remain;
    const progress = getQuotaProgress(used, total);
    const showCarry = carryBalance !== undefined;

    return (
        <Card className="h-full border-border-subtle shadow-none">
            <CardContent className="flex h-full flex-col p-5">
                <div className="min-w-0">
                    <p className="text-base/6 font-semibold text-content-heading">{title}</p>
                    <p className="mt-1 text-xs/5 font-medium text-content-muted">{note}</p>
                    <div className="mt-4 flex items-baseline gap-2">
                        <p
                            className={cn(
                                "tabular-nums text-4xl font-bold tracking-tight",
                                isOverQuota ? "text-status-danger-strong" : theme.valueColor,
                            )}
                        >
                            {displayedRemain}
                        </p>
                        <p className="text-sm/6 font-semibold text-content-secondary">
                            {isOverQuota ? "วันเกินสิทธิ์" : "วันคงเหลือ"}
                        </p>
                    </div>
                </div>

                <div className="mt-4 space-y-1 text-xs/5 text-content-secondary">
                    <p>
                        สิทธิประจำปี <span className="tabular-nums">{annualTotal} วัน</span>
                    </p>
                    {showCarry ? (
                        <p
                            className={cn(
                                "break-words tabular-nums font-medium",
                                carryBalance < 0 && "text-status-danger-strong",
                            )}
                        >
                            {carryBalance < 0 ? "ยอดเกินสิทธิ์ยกมา" : "ยอดยกมา"}{" "}
                            {formatSignedDays(carryBalance)} วัน
                        </p>
                    ) : null}
                </div>

                <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between gap-3 text-xs/5 font-medium text-content-secondary">
                        <span>ใช้ไปแล้ว</span>
                        <span className="tabular-nums">
                            {total > 0 ? `${used}/${total} วัน` : `${used} วัน`}
                        </span>
                    </div>
                    <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        aria-label={
                            total > 0
                                ? `ใช้วันลาไปแล้ว ${used} จาก ${total} วัน`
                                : `ใช้วันลาไปแล้ว ${used} วัน โดยสิทธิรวมไม่เป็นบวก`
                        }
                    >
                        <div
                            className={cn("h-full rounded-full", isOverQuota ? "bg-status-danger-fill" : theme.barColor)}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function LeaveQuotaCards({ sickQuota, personalQuota, vacationQuota }: LeaveQuotaCardsProps) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <QuotaCard
                title="ลาป่วย"
                remain={sickQuota.remainingDays}
                used={sickQuota.usedDays}
                total={sickQuota.effectiveTotalDays}
                annualTotal={sickQuota.totalDays}
                note="สิทธิประจำปี"
                theme={{
                    valueColor: "text-status-success-foreground",
                    barColor: "bg-status-success-fill",
                }}
            />
            <QuotaCard
                title="ลากิจ"
                remain={personalQuota.remainingDays}
                used={personalQuota.usedDays}
                total={personalQuota.effectiveTotalDays}
                annualTotal={personalQuota.totalDays}
                carryBalance={personalQuota.carryBalanceDays}
                note="สิทธิรวมหลังยอดยกมา"
                theme={{
                    valueColor: "text-brand-emphasis",
                    barColor: "bg-brand-icon",
                }}
            />
            <QuotaCard
                title="ลาพักร้อน"
                remain={vacationQuota.remainingDays}
                used={vacationQuota.usedDays}
                total={vacationQuota.effectiveTotalDays}
                annualTotal={vacationQuota.totalDays}
                carryBalance={vacationQuota.carryBalanceDays}
                note="สิทธิรวมหลังยอดยกมา"
                theme={{
                    valueColor: "text-status-warning-foreground",
                    barColor: "bg-status-warning-fill",
                }}
            />
        </div>
    );
}

function getQuotaProgress(used: number, total: number): number {
    if (total <= 0) {
        return 100;
    }

    return Math.min(100, Math.max(0, (used / total) * 100));
}

function formatSignedDays(days: number): string {
    if (days > 0) {
        return `+${days}`;
    }
    return String(days);
}
