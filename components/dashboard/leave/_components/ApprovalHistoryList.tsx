import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
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
            <Card className="shadow-sm border-gray-100 p-8 text-center text-gray-500">
                ยังไม่มีข้อมูลการพิจารณาในระบบ
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {history.map((leave) => (
                <Card
                    key={leave.id}
                    className="shadow-sm border-gray-100 p-4 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                >
                    <div>
                        <p className="font-medium text-gray-800 text-sm">
                            {leave.employee.firstName} {leave.employee.lastName}
                            <span className="text-gray-400 font-normal ml-2">ยื่นลา{leaveShortLabel(leave.leaveType)}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
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
                    </div>
                    <div>
                        <LeaveStatusBadge status={leave.status} />
                    </div>
                </Card>
            ))}
        </div>
    );
}
