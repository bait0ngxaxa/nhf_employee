import {
    AlertTriangle,
    Briefcase,
    CheckCircle,
    Palmtree,
    Thermometer,
    UserCircle2,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { LEAVE_THEME_BUTTON_CLASS } from "../leaveTheme";
import { LeaveAttachmentViewerButton } from "./LeaveAttachmentViewerButton";

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
        <Card className="border-border-subtle p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-module-leave-badge-surface text-module-leave-badge-foreground">
                            <UserCircle2 className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="break-words text-lg/7 font-semibold tracking-tight text-content-heading">
                                {getEmployeeDisplayName(leave.employee)}
                            </h3>
                            <p className="mt-1 break-words text-sm/6 font-medium text-content-secondary">
                                {leave.employee.position} · {leave.employee.dept?.name ?? "ไม่ระบุแผนก"}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 rounded-xl border border-module-leave-badge-border bg-module-leave-badge-surface/60 p-4 sm:grid-cols-2">
                        <InfoRow
                            icon={LeaveTypeIcon}
                            label="ประเภทการลา"
                            value={leaveTypeLabel(leave.leaveType)}
                        />
                        <div className="min-w-0">
                            <p className="text-xs/5 font-medium text-module-leave-badge-foreground">วันที่ลา</p>
                            <p className="mt-1 break-words text-base/6 font-semibold text-content-heading">
                                {formatLeaveDateRange(leave.startDate, leave.endDate)}
                            </p>
                            <p className="mt-1 text-sm/6 font-medium text-content-secondary">
                                {periodLabel(leave.period)} ({leave.durationDays} วัน)
                            </p>
                        </div>
                    </div>

                    {leave.reason ? (
                        <p className="max-w-[75ch] rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm/6 text-content-body">
                            <span className="font-medium text-content-heading">เหตุผล: </span>
                            <span className="break-words">{leave.reason}</span>
                        </p>
                    ) : null}

                    {leave.emergencyReason || leave.specialReason || leave.overQuotaDays > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {leave.emergencyReason ? <SpecialFlag label="ลาย้อนหลัง" /> : null}
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

                    <div className="border-t border-border-subtle pt-4">
                        <p className="text-xs/5 font-semibold text-content-muted">ส่งคำขอเมื่อ</p>
                        <p className="mt-1 text-sm/6 font-medium text-content-secondary">
                            {formatThaiDateTimeWithTimeWord(leave.createdAt)}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:w-40 lg:flex-col">
                    <LeaveAttachmentViewerButton
                        attachments={leave.attachments}
                        className="w-full"
                    />
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
                        className="border-status-danger-border text-status-danger-foreground hover:bg-status-danger-surface hover:text-status-danger-strong"
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
            <p className="text-xs/5 font-medium text-module-leave-badge-foreground">{label}</p>
            <p className="mt-1 flex items-start gap-2 break-words text-base/6 font-semibold text-content-heading">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-module-leave-badge-foreground" aria-hidden="true" />
                <span>{value}</span>
            </p>
        </div>
    );
}

function SpecialFlag({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center rounded-full border border-status-warning-border bg-status-warning-surface px-2.5 py-1 text-xs font-medium text-status-warning-strong">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {label}
        </span>
    );
}

function EmptyPendingApproval() {
    return (
        <Card className="border-dashed border-border-strong p-8 text-center shadow-none">
            <CheckCircle className="mx-auto h-8 w-8 text-status-success-foreground" aria-hidden="true" />
            <p className="mt-3 text-base/6 font-semibold text-content-primary">ไม่มีคำขอที่ต้องพิจารณา</p>
            <p className="mt-1 text-sm/6 text-content-muted">คำขอใหม่จากทีมจะแสดงที่นี่</p>
        </Card>
    );
}

function formatLeaveDateRange(startDate: string, endDate: string): string {
    const formatter = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const start = formatter.format(new Date(startDate));

    if (startDate === endDate) {
        return start;
    }

    return `${start} - ${formatter.format(new Date(endDate))}`;
}

