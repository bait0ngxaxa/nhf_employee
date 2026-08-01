import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
import { LeaveAttachmentViewerButton } from "./LeaveAttachmentViewerButton";
import { LeaveStatusBadge } from "./LeaveStatusBadge";

interface ApprovalHistoryListProps {
    history: PendingLeave[];
}

const leaveShortLabel = (leaveType: PendingLeave["leaveType"]): string => {
    if (leaveType === "SICK") return "ป่วย";
    if (leaveType === "PERSONAL") return "กิจ";
    return "พักร้อน";
};

export function ApprovalHistoryList({ history }: ApprovalHistoryListProps) {
    if (history.length === 0) {
        return (
            <Card className="border-dashed border-border-strong p-8 text-center shadow-none">
                <p className="text-sm font-medium text-content-strong">ยังไม่มีข้อมูลการพิจารณาในระบบ</p>
                <p className="mt-1 text-sm text-content-muted">
                    รายการที่อนุมัติหรือไม่อนุมัติแล้วจะแสดงที่นี่
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {history.map((leave) => (
                <Card
                    key={leave.id}
                    className="flex flex-col gap-3 border-border-subtle p-4 shadow-sm md:flex-row md:items-start md:justify-between"
                >
                    <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-content-heading">
                            {leave.employee.firstName} {leave.employee.lastName}
                            <span className="ml-2 font-normal text-content-secondary">
                                ยื่นคำขอลา{leaveShortLabel(leave.leaveType)}
                            </span>
                        </p>
                        <p className="mt-1 text-xs text-content-secondary">
                            วันที่:{" "}
                            {new Intl.DateTimeFormat("th-TH", {
                                day: "numeric",
                                month: "short",
                                year: "2-digit",
                            }).format(new Date(leave.startDate))}
                            {leave.startDate !== leave.endDate
                                ? ` - ${new Intl.DateTimeFormat("th-TH", {
                                      day: "numeric",
                                      month: "short",
                                      year: "2-digit",
                                  }).format(new Date(leave.endDate))}`
                                : ""}
                            ({leave.durationDays} วัน)
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-content-muted">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            ยื่นคำขอเมื่อ {formatThaiDateTimeWithTimeWord(leave.createdAt)}
                        </p>
                        {leave.status === "NOT_TAKEN" && leave.notTakenReason ? (
                            <p className="mt-2 break-words rounded-md border border-cyan-200 bg-cyan-50 p-2 text-sm leading-6 text-cyan-900">
                                ไม่ได้ใช้วันลา: {leave.notTakenReason}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
                        <LeaveStatusBadge status={leave.status} />
                        <LeaveAttachmentViewerButton attachments={leave.attachments} />
                    </div>
                </Card>
            ))}
        </div>
    );
}
