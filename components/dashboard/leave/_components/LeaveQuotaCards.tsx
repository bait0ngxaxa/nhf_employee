import type { ComponentType } from "react";
import { Briefcase, Palmtree, Thermometer } from "lucide-react";
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
    icon: ComponentType<{ className?: string }>;
    theme: {
        iconSurface: string;
        iconColor: string;
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
    icon: Icon,
    theme,
}: QuotaCardProps) {
    const isOverQuota = remain < 0;
    const displayedRemain = isOverQuota ? Math.abs(remain) : remain;
    const progress = getQuotaProgress(used, total);
    const showCarry = carryBalance !== undefined;

    return (
        <Card className="h-full border-border-subtle shadow-sm">
            <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-base/6 font-semibold text-content-heading">{title}</p>
                        <p className="mt-1 text-xs/5 font-medium text-content-muted">{note}</p>
                        <div className="mt-4 flex items-baseline gap-2">
                            <p
                                className={cn(
                                    "tabular-nums text-4xl font-bold tracking-tight",
                                    isOverQuota ? "text-rose-700" : theme.valueColor,
                                )}
                            >
                                {displayedRemain}
                            </p>
                            <p className="text-sm/6 font-semibold text-content-secondary">
                                {isOverQuota ? "วันเกินสิทธิ์" : "วันคงเหลือ"}
                            </p>
                        </div>
                    </div>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", theme.iconSurface)}>
                        <Icon className={cn("h-5 w-5", theme.iconColor)} aria-hidden="true" />
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
                                carryBalance < 0 && "text-rose-700",
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
                            className={cn("h-full rounded-full", isOverQuota ? "bg-rose-500" : theme.barColor)}
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
                icon={Thermometer}
                theme={{
                    iconSurface: "bg-emerald-50",
                    iconColor: "text-emerald-700",
                    valueColor: "text-emerald-700",
                    barColor: "bg-emerald-500",
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
                icon={Briefcase}
                theme={{
                    iconSurface: "bg-sky-50",
                    iconColor: "text-sky-700",
                    valueColor: "text-sky-700",
                    barColor: "bg-sky-500",
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
                icon={Palmtree}
                theme={{
                    iconSurface: "bg-amber-50",
                    iconColor: "text-amber-700",
                    valueColor: "text-amber-700",
                    barColor: "bg-amber-500",
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
