import {
    AlertTriangle,
    Briefcase,
    CalendarRange,
    CheckCircle,
    Clock,
    Palmtree,
    Thermometer,
    UserCircle2,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
import { LEAVE_THEME_BUTTON_CLASS } from "../leaveTheme";

interface PendingApprovalListProps {
    pending: PendingLeave[];
    isProcessing: boolean;
    onApprove: (leave: PendingLeave) => Promise<void>;
    onOpenReject: (leave: PendingLeave) => void;
}

const leaveTypeLabel = (leaveType: PendingLeave["leaveType"]): string => {
    if (leaveType === "SICK") return "ลาป่วย";
    if (leaveType === "PERSONAL") return "ลากิจ";
    return "ลาพักร้อน";
};

const periodLabel = (period: PendingLeave["period"]): string => {
    if (period === "FULL_DAY") return "เต็มวัน";
    if (period === "MORNING") return "เช้า";
    return "บ่าย";
};

const leaveTypeIcon = (leaveType: PendingLeave["leaveType"]): LucideIcon => {
    if (leaveType === "SICK") return Thermometer;
    if (leaveType === "PERSONAL") return Briefcase;
    return Palmtree;
};

export function PendingApprovalList({
    pending,
    isProcessing,
    onApprove,
    onOpenReject,
}: PendingApprovalListProps) {
    if (pending.length === 0) {
        return <EmptyPendingApproval />;
    }

    return (
        <div className="space-y-3">
            {pending.map((leave) => (
                <PendingApprovalCard
                    key={leave.id}
                    leave={leave}
                    isProcessing={isProcessing}
                    onApprove={onApprove}
                    onOpenReject={onOpenReject}
                />
            ))}
        </div>
    );
}

function PendingApprovalCard({
    leave,
    isProcessing,
    onApprove,
    onOpenReject,
}: {
    leave: PendingLeave;
    isProcessing: boolean;
    onApprove: (leave: PendingLeave) => Promise<void>;
    onOpenReject: (leave: PendingLeave) => void;
}) {
    const LeaveTypeIcon = leaveTypeIcon(leave.leaveType);

    return (
        <Card className="border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                            <UserCircle2 className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="break-words text-lg/7 font-semibold tracking-tight text-slate-950">
                                {leave.employee.firstName} {leave.employee.lastName}
                                {leave.employee.nickname ? (
                                    <span className="font-normal text-slate-600">
                                        {" "}({leave.employee.nickname})
                                    </span>
                                ) : null}
                            </h3>
                            <p className="mt-1 break-words text-sm/6 font-medium text-slate-600">
                                {leave.employee.position} · {leave.employee.dept?.name ?? "ไม่ระบุแผนก"}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:grid-cols-2">
                        <InfoRow
                            icon={LeaveTypeIcon}
                            label="ประเภทการลา"
                            value={leaveTypeLabel(leave.leaveType)}
                        />
                        <InfoRow
                            icon={CalendarRange}
                            label="ระยะเวลา"
                            value={`${formatLeaveDateRange(leave.startDate, leave.endDate)} (${leave.durationDays} วัน, ${periodLabel(leave.period)})`}
                        />
                    </div>

                    {leave.reason ? (
                        <p className="max-w-[75ch] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm/6 text-slate-700">
                            <span className="font-medium text-slate-950">เหตุผล: </span>
                            <span className="break-words">{leave.reason}</span>
                        </p>
                    ) : null}

                    {leave.emergencyReason || leave.specialReason || leave.overQuotaDays > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {leave.emergencyReason ? <SpecialFlag label="ลาย้อนหลังกรณีฉุกเฉิน" /> : null}
                            {leave.specialReason || leave.overQuotaDays > 0 ? (
                                <SpecialFlag
                                    label={
                                        leave.overQuotaDays > 0
                                            ? `เกินสิทธิ์ ${leave.overQuotaDays} วัน`
                                            : "ลาเกินโควต้ากรณีพิเศษ"
                                    }
                                />
                            ) : null}
                        </div>
                    ) : null}

                    <p className="flex items-center gap-1.5 text-xs/5 font-medium text-slate-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        ยื่นใบลาเมื่อ {formatSubmittedAt(leave.createdAt)}
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:w-40 lg:flex-col">
                    <Button
                        onClick={() => onApprove(leave)}
                        disabled={isProcessing}
                        className={LEAVE_THEME_BUTTON_CLASS}
                    >
                        <CheckCircle className="h-4 w-4" aria-hidden="true" />
                        อนุมัติ
                    </Button>
                    <Button
                        onClick={() => onOpenReject(leave)}
                        disabled={isProcessing}
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        ไม่อนุมัติ
                    </Button>
                </div>
            </div>
        </Card>
    );
}

function InfoRow({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0">
            <p className="text-xs/5 font-medium text-indigo-700">{label}</p>
            <p className="mt-1 flex items-start gap-2 break-words text-base/6 font-semibold text-slate-950">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                <span>{value}</span>
            </p>
        </div>
    );
}

function SpecialFlag({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {label}
        </span>
    );
}

function EmptyPendingApproval() {
    return (
        <Card className="border-dashed border-slate-300 p-8 text-center shadow-none">
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
            <p className="mt-3 text-base/6 font-semibold text-slate-900">ไม่มีคำขอที่ต้องพิจารณา</p>
            <p className="mt-1 text-sm/6 text-slate-500">คำขอใหม่จากทีมจะแสดงที่นี่</p>
        </Card>
    );
}

function formatLeaveDateRange(startDate: string, endDate: string): string {
    const formatter = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
    });
    const start = formatter.format(new Date(startDate));

    if (startDate === endDate) {
        return start;
    }

    return `${start} - ${formatter.format(new Date(endDate))}`;
}

function formatSubmittedAt(createdAt: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(createdAt));
}
