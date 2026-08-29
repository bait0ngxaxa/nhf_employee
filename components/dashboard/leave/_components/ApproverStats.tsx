import { Card, CardContent } from "@/components/ui/card";

interface ApproverStatsProps {
    totalEmployees: number;
    activeApprovers: number;
    unassignedCount: number;
}

interface StatCardProps {
    label: string;
    value: number;
    color: "sky" | "emerald" | "amber" | "gray";
}

function StatCard({ label, value, color }: StatCardProps) {
    const colorMap: Record<StatCardProps["color"], { card: string; text: string }> = {
        sky: {
            card: "border-brand-border bg-brand-surface",
            text: "text-brand-strong",
        },
        emerald: {
            card: "border-status-success-border bg-status-success-surface",
            text: "text-status-success-strong",
        },
        amber: {
            card: "border-status-warning-border bg-status-warning-surface",
            text: "text-status-warning-strong",
        },
        gray: {
            card: "border-border-subtle bg-surface-subtle",
            text: "text-content-body",
        },
    };
    const c = colorMap[color];

    return (
        <Card className={`${c.card} shadow-none`}>
            <CardContent className="space-y-1 pt-5 pb-4">
                <p className="text-sm text-content-secondary">{label}</p>
                <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

export function ApproverStats({
    totalEmployees,
    activeApprovers,
    unassignedCount,
}: ApproverStatsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="พนักงานทั้งหมด" value={totalEmployees} color="sky" />
            <StatCard label="ผู้อนุมัติ" value={activeApprovers} color="emerald" />
            <StatCard
                label="ยังไม่กำหนดผู้อนุมัติ"
                value={unassignedCount}
                color={unassignedCount > 0 ? "amber" : "gray"}
            />
        </div>
    );
}
