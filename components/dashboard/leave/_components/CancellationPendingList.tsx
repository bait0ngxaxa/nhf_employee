import { CheckCircle2, RotateCcw } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
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
        <Card className="border-status-warning-border bg-status-warning-surface p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <p className="break-words text-base/6 font-semibold text-content-heading">
                        {getEmployeeDisplayName(leave.employee)}
                        <span className="ml-2 font-normal text-content-secondary">
                            ขอยกเลิกวันลาที่อนุมัติแล้ว
                        </span>
                    </p>
                    <div className="mt-3 grid gap-3 border-t border-status-warning-border pt-3 sm:grid-cols-2">
                        <div className="min-w-0 space-y-1">
                            <p className="text-xs/5 font-semibold text-status-warning-strong">วันที่ลา</p>
                            <p className="break-words text-sm/6 font-medium text-content-secondary">
                                {formatLeaveDateRange(leave.startDate, leave.endDate)}
                            </p>
                            <p className="text-xs/5 font-medium text-status-warning-strong">
                                ({leave.durationDays} วัน)
                            </p>
                        </div>
                        <div className="min-w-0 space-y-1">
                            <p className="text-xs/5 font-semibold text-status-warning-strong">
                                ส่งคำขอยกเลิกเมื่อ
                            </p>
                            <p className="break-words text-sm/6 font-medium text-content-secondary">
                                {leave.cancellationRequestedAt
                                    ? formatThaiDateTimeWithTimeWord(leave.cancellationRequestedAt)
                                    : "-"}
                            </p>
                        </div>
                    </div>
                    {leave.cancellationReason ? (
                        <p className="mt-2 max-w-[75ch] break-words rounded-md border border-status-warning-border bg-surface-raised p-2 text-sm/6 text-status-warning-strong">
                            เหตุผล: {leave.cancellationReason}
                        </p>
                    ) : null}
                    {!canConfirm ? (
                        <p className="mt-2 text-sm/6 font-medium text-status-warning-strong">
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
