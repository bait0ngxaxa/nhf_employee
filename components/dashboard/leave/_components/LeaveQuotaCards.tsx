import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Thermometer, Briefcase, Palmtree } from "lucide-react";
import type { LeaveQuota } from "@/hooks/useLeaveProfile";

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
        halo: string;
        numberGradient: string;
        iconBg: string;
        iconColor: string;
    };
}

function QuotaCard({ title, remain, used, total, note, icon: Icon, theme }: QuotaCardProps) {
    return (
        <Card className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl transition-[box-shadow,transform] duration-300 rounded-3xl group">
            <div
                className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl ${theme.halo} group-hover:opacity-20 transition-opacity duration-500 pointer-events-none`}
            />
            <CardContent className="p-5 md:p-6 relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
                        <div className="flex items-baseline space-x-2">
                            <p
                                className={`tabular-nums text-3xl font-extrabold bg-gradient-to-r ${theme.numberGradient} bg-clip-text text-transparent tracking-tight`}
                            >
                                {remain}
                            </p>
                            <p className="text-sm font-medium text-gray-500">วันคงเหลือ</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            ใช้ไปแล้ว: {used}/{total} วัน ({note})
                        </p>
                    </div>
                    <div
                        className={`p-3 rounded-2xl ${theme.iconBg} group-hover:scale-110 transition-transform duration-300`}
                    >
                        <Icon className={`h-6 w-6 ${theme.iconColor}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function LeaveQuotaCards({ sickQuota, personalQuota, vacationQuota }: LeaveQuotaCardsProps) {
    return (
        <div className="grid gap-6 md:grid-cols-3">
            <QuotaCard
                title="ลาป่วย"
                remain={Math.max(0, sickQuota.totalDays - sickQuota.usedDays)}
                used={sickQuota.usedDays}
                total={sickQuota.totalDays}
                note="โควต้า 30 วัน/ปี"
                icon={Thermometer}
                theme={{
                    halo: "bg-gradient-to-br from-emerald-500 to-teal-600",
                    numberGradient: "from-emerald-500 to-teal-600",
                    iconBg: "bg-emerald-100/80",
                    iconColor: "text-emerald-600",
                }}
            />
            <QuotaCard
                title="ลากิจ"
                remain={Math.max(0, personalQuota.totalDays - personalQuota.usedDays)}
                used={personalQuota.usedDays}
                total={personalQuota.totalDays}
                note="สิทธิปีนี้"
                icon={Briefcase}
                theme={{
                    halo: "bg-gradient-to-br from-blue-500 to-indigo-600",
                    numberGradient: "from-blue-500 to-indigo-600",
                    iconBg: "bg-blue-100/80",
                    iconColor: "text-blue-600",
                }}
            />
            <QuotaCard
                title="ลาพักร้อน"
                remain={Math.max(0, vacationQuota.totalDays - vacationQuota.usedDays)}
                used={vacationQuota.usedDays}
                total={vacationQuota.totalDays}
                note="สิทธิปีนี้"
                icon={Palmtree}
                theme={{
                    halo: "bg-gradient-to-br from-amber-500 to-orange-600",
                    numberGradient: "from-amber-500 to-orange-600",
                    iconBg: "bg-amber-100/80",
                    iconColor: "text-amber-600",
                }}
            />
        </div>
    );
}
