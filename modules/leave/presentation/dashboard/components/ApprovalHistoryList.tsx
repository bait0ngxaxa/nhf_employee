import { Card } from "@/components/ui/card";
import type { PendingLeave } from "../hooks/useLeaveApprovals";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { LeaveAttachmentViewerButton } from "./LeaveAttachmentViewerButton";
import { LeaveStatusBadge } from "./LeaveStatusBadge";

interface ApprovalHistoryListProps {
    history: PendingLeave[];
    isFiltered?: boolean;
}

const leaveShortLabel = (leaveType: PendingLeave["leaveType"]): string => {
    if (leaveType === "SICK") return "ป่วย";
    if (leaveType === "PERSONAL") return "กิจ";
    return "พักร้อน";
};

const periodLabel = (period: PendingLeave["period"]): string => {
    if (period === "FULL_DAY") return "เต็มวัน";
    if (period === "MORNING") return "ช่วงเช้า";
    return "ช่วงบ่าย";
};

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

export function ApprovalHistoryList({ history, isFiltered = false }: ApprovalHistoryListProps) {
    if (history.length === 0) {
        return (
            <Card className="border-dashed border-border-strong p-8 text-center shadow-none">
                {isFiltered ? (
                    <>
                        <p className="text-sm font-medium text-content-strong">
                            ไม่พบประวัติการพิจารณาตามตัวกรองที่เลือก
                        </p>
                        <p className="mt-1 text-sm text-content-muted">
                            ลองปรับหรือล้างตัวกรองเพื่อดูรายการอื่น
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-sm font-medium text-content-strong">
                            ยังไม่มีข้อมูลการพิจารณาในระบบ
                        </p>
                        <p className="mt-1 text-sm text-content-muted">
                            รายการที่อนุมัติหรือไม่อนุมัติแล้วจะแสดงที่นี่
                        </p>
                    </>
                )}
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {history.map((leave) => (
                <Card
                    key={leave.id}
                    className="border-border-subtle p-4 shadow-sm"
                >
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="break-words text-sm font-medium text-content-heading">
                                    {getEmployeeDisplayName(leave.employee)}
                                </p>
                                <p className="mt-1 break-words text-sm text-content-secondary">
                                    ยื่นคำขอลา{leaveShortLabel(leave.leaveType)}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                <span className="text-xs/5 font-semibold text-content-muted">
                                    สถานะคำขอ
                                </span>
                                <LeaveStatusBadge status={leave.status} />
                            </div>
                        </div>

                        <div className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
                            <div className="min-w-0 space-y-1">
                                <p className="text-xs/5 font-semibold text-content-muted">
                                    วันที่ลา
                                </p>
                                <p className="break-words text-sm/6 font-medium text-content-secondary">
                                    {formatLeaveDateRange(leave.startDate, leave.endDate)}
                                </p>
                                <p className="text-xs/5 font-medium text-content-muted">
                                    {periodLabel(leave.period)} ({leave.durationDays} วัน)
                                </p>
                            </div>
                            <div className="min-w-0 space-y-1 sm:text-right">
                                <p className="text-xs/5 font-semibold text-content-muted">
                                    ส่งคำขอเมื่อ
                                </p>
                                <p className="break-words text-sm/6 font-medium text-content-secondary">
                                    {formatThaiDateTimeWithTimeWord(leave.createdAt)}
                                </p>
                            </div>
                        </div>

                        {leave.status === "NOT_TAKEN" && leave.notTakenReason ? (
                            <p className="break-words rounded-md border border-status-info-border bg-status-info-surface p-2 text-sm leading-6 text-status-info-emphasis">
                                ไม่ได้ใช้วันลา: {leave.notTakenReason}
                            </p>
                        ) : null}

                        {leave.attachments.length > 0 ? (
                            <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs/5 font-semibold text-content-muted">เอกสารแนบ</p>
                                <LeaveAttachmentViewerButton attachments={leave.attachments} />
                            </div>
                        ) : null}
                    </div>
                </Card>
            ))}
        </div>
    );
}
