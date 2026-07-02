import type { ComponentType } from "react";
import { Briefcase, Palmtree, Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LeaveQuota } from "@/hooks/useLeaveProfile";
import { cn } from "@/lib/ui/utils";

interface LeaveQuotaCardsProps {
    sickQuota: LeaveQuota | { totalDays: number; usedDays: number };
    personalQuota: LeaveQuota | { totalDays: number; usedDays: number };
    vacationQuota: LeaveQuota | { totalDays: number; usedDays: number };
}

interface QuotaCardProps {
    title: string;
    remain: number;
    used: number;
    total: number;
    note: string;
    icon: ComponentType<{ className?: string }>;
    theme: {
        iconSurface: string;
        iconColor: string;
        valueColor: string;
        barColor: string;
    };
}

function QuotaCard({ title, remain, used, total, note, icon: Icon, theme }: QuotaCardProps) {
    const isOverQuota = remain < 0;
    const displayedRemain = isOverQuota ? Math.abs(remain) : remain;
    const progress = getQuotaProgress(used, total);

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-base/6 font-semibold text-slate-950">{title}</p>
                        <p className="mt-1 text-xs/5 font-medium text-slate-500">{note}</p>
                        <div className="mt-4 flex items-baseline gap-2">
                            <p className={cn("tabular-nums text-4xl font-bold tracking-tight", isOverQuota ? "text-rose-700" : theme.valueColor)}>
                                {displayedRemain}
                            </p>
                            <p className="text-sm/6 font-semibold text-slate-600">
                                {isOverQuota ? "วันเกินสิทธิ์" : "วันคงเหลือ"}
                            </p>
                        </div>
                    </div>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", theme.iconSurface)}>
                        <Icon className={cn("h-5 w-5", theme.iconColor)} aria-hidden="true" />
                    </div>
                </div>

                <div className="mt-5">
                    <div className="flex items-center justify-between gap-3 text-xs/5 font-medium text-slate-600">
                        <span>ใช้ไปแล้ว</span>
                        <span className="tabular-nums">{used}/{total} วัน</span>
                    </div>
                    <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                        aria-label={`ใช้วันลาไปแล้ว ${used} จาก ${total} วัน`}
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
        <div className="grid gap-4 md:grid-cols-3">
            <QuotaCard
                title="ลาป่วย"
                remain={sickQuota.totalDays - sickQuota.usedDays}
                used={sickQuota.usedDays}
                total={sickQuota.totalDays}
                note="โควต้า 30 วัน/ปี"
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
                remain={personalQuota.totalDays - personalQuota.usedDays}
                used={personalQuota.usedDays}
                total={personalQuota.totalDays}
                note="สิทธิปีนี้"
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
                remain={vacationQuota.totalDays - vacationQuota.usedDays}
                used={vacationQuota.usedDays}
                total={vacationQuota.totalDays}
                note="สิทธิปีนี้"
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
        return 0;
    }

    return Math.min(100, Math.max(0, (used / total) * 100));
}
