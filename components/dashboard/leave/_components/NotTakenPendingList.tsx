import { RotateCcw } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { LEAVE_THEME_BUTTON_CLASS } from "../leaveTheme";
import { LeaveAttachmentViewerButton } from "./LeaveAttachmentViewerButton";

interface NotTakenPendingListProps {
    items: PendingLeave[];
    isProcessing: boolean;
    onConfirm: (leaveId: string) => Promise<boolean>;
}

export function NotTakenPendingList({
    items,
    isProcessing,
    onConfirm,
}: NotTakenPendingListProps): ReactElement {
    if (items.length === 0) {
        return (
            <Card className="border-dashed border-border-strong p-6 text-center shadow-none">
                <p className="text-base/6 font-semibold text-content-primary">
                    ไม่มีรายการรอยืนยันไม่ได้ใช้วันลา
                </p>
                <p className="mt-1 text-sm/6 text-content-muted">
                    เมื่อพนักงานแจ้งไม่ได้ใช้วันลา รายการจะปรากฏที่นี่
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((leave) => (
                <Card key={leave.id} className="border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                            <p className="break-words text-base/6 font-semibold text-content-heading">
                                {getEmployeeDisplayName(leave.employee)}
                                <span className="ml-2 font-normal text-content-secondary">
                                    แจ้งไม่ได้ใช้วันลา
                                </span>
                            </p>
                            <p className="mt-1 text-sm/6 font-medium text-content-secondary">
                                วันที่ {new Date(leave.startDate).toLocaleDateString("th-TH")}
                                {leave.startDate !== leave.endDate
                                    ? ` - ${new Date(leave.endDate).toLocaleDateString("th-TH")}`
                                    : ""}{" "}
                                ({leave.durationDays} วัน)
                            </p>
                            {leave.notTakenReason ? (
                                <p className="mt-2 max-w-[75ch] break-words rounded-md border border-cyan-200 bg-surface-raised p-2 text-sm/6 text-cyan-900">
                                    {leave.notTakenReason}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
                            <LeaveAttachmentViewerButton attachments={leave.attachments} />
                            <Button
                                disabled={isProcessing}
                                className={LEAVE_THEME_BUTTON_CLASS}
                                onClick={() => onConfirm(leave.id)}
                            >
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                ยืนยันคืนโควต้า
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
