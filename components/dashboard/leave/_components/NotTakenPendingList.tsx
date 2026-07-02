import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";

interface NotTakenPendingListProps {
    items: PendingLeave[];
    isProcessing: boolean;
    onConfirm: (leaveId: string) => Promise<void>;
}

export function NotTakenPendingList({
    items,
    isProcessing,
    onConfirm,
}: NotTakenPendingListProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {items.map((leave) => (
                <Card key={leave.id} className="border-cyan-100 bg-cyan-50/40 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                {leave.employee.firstName} {leave.employee.lastName}
                                <span className="ml-2 font-normal text-gray-500">
                                    แจ้งไม่ได้ใช้วันลา
                                </span>
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                วันที่ {new Date(leave.startDate).toLocaleDateString("th-TH")}
                                {leave.startDate !== leave.endDate
                                    ? ` - ${new Date(leave.endDate).toLocaleDateString("th-TH")}`
                                    : ""}{" "}
                                ({leave.durationDays} วัน)
                            </p>
                            {leave.notTakenReason ? (
                                <p className="mt-2 rounded-md border border-cyan-100 bg-white/70 p-2 text-xs text-cyan-800">
                                    {leave.notTakenReason}
                                </p>
                            ) : null}
                        </div>
                        <Button
                            disabled={isProcessing}
                            className="bg-cyan-600 hover:bg-cyan-700"
                            onClick={() => onConfirm(leave.id)}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            ยืนยันคืนโควต้า
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}
