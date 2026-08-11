import { CalendarRange, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { LEAVE_THEME_BUTTON_CLASS } from "../leaveTheme";
import { LeaveAttachmentViewerButton } from "./LeaveAttachmentViewerButton";
import { isBeforeLeaveStart } from "@/lib/services/leave/utils";

interface CancellationPendingListProps {
    items: PendingLeave[];
    isProcessing: boolean;
    onConfirm: (leaveId: string) => Promise<boolean>;
    onReject: (leaveId: string) => Promise<boolean>;
}

export function CancellationPendingList({
    items,
    isProcessing,
    onConfirm,
    onReject,
}: CancellationPendingListProps): ReactElement {
    if (items.length === 0) {
        return (
            <Card className="border-dashed border-border-strong p-6 text-center shadow-none">
                <p className="text-base/6 font-semibold text-content-primary">
                    ไม่มีรายการรอยืนยันยกเลิกวันลา
                </p>
                <p className="mt-1 text-sm/6 text-content-muted">
                    เมื่อพนักงานขอยกเลิกวันลาที่อนุมัติแล้ว รายการจะปรากฏที่นี่
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((leave) => (
                <CancellationPendingItem
                    key={leave.id}
                    leave={leave}
                    isProcessing={isProcessing}
                    onConfirm={onConfirm}
                    onReject={onReject}
                />
            ))}
        </div>
    );
}

function CancellationPendingItem({
    leave,
    isProcessing,
    onConfirm,
    onReject,
}: {
    leave: PendingLeave;
    isProcessing: boolean;
    onConfirm: (leaveId: string) => Promise<boolean>;
    onReject: (leaveId: string) => Promise<boolean>;
}) {
    const canConfirm = isBeforeLeaveStart(leave.startDate);

    return (
        <Card className="border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <p className="break-words text-base/6 font-semibold text-content-heading">
                        {getEmployeeDisplayName(leave.employee)}
                        <span className="ml-2 font-normal text-content-secondary">
                            ขอยกเลิกวันลาที่อนุมัติแล้ว
                        </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm/6 font-medium text-content-secondary">
                        <CalendarRange className="h-4 w-4 text-amber-700" aria-hidden="true" />
                        {new Date(leave.startDate).toLocaleDateString("th-TH")}
                        {leave.startDate !== leave.endDate
                            ? ` - ${new Date(leave.endDate).toLocaleDateString("th-TH")}`
                            : ""} ({leave.durationDays} วัน)
                    </p>
                    {leave.cancellationReason ? (
                        <p className="mt-2 max-w-[75ch] break-words rounded-md border border-amber-200 bg-surface-raised p-2 text-sm/6 text-amber-900">
                            เหตุผล: {leave.cancellationReason}
                        </p>
                    ) : null}
                    <p className="mt-2 flex items-center gap-1.5 text-xs/5 font-medium text-content-muted">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        รอยืนยันตั้งแต่ {leave.cancellationRequestedAt
                            ? new Date(leave.cancellationRequestedAt).toLocaleDateString("th-TH")
                            : "-"}
                    </p>
                    {!canConfirm ? (
                        <p className="mt-2 text-sm/6 font-medium text-amber-900">
                            วันลาเริ่มแล้ว ไม่สามารถยืนยันการยกเลิกและคืนโควต้าได้
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:shrink-0 md:justify-end">
                    <LeaveAttachmentViewerButton attachments={leave.attachments} />
                    <Button
                        disabled={isProcessing || !canConfirm}
                        className={LEAVE_THEME_BUTTON_CLASS}
                        onClick={() => onConfirm(leave.id)}
                    >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ยืนยันยกเลิกและคืนโควต้า
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => onReject(leave.id)}
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        ปิดคำขอยกเลิก
                    </Button>
                </div>
            </div>
        </Card>
    );
}
