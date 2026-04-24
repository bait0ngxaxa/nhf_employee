"use client";

import { Loader2 } from "lucide-react";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import { PendingApprovalList } from "./_components/PendingApprovalList";
import { ApprovalHistoryList } from "./_components/ApprovalHistoryList";
import { RejectLeaveDialog } from "./_components/RejectLeaveDialog";

export function ManagerApprovalDashboard() {
    const model = useManagerApprovalModel();

    if (model.isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">รายการรอพิจารณา</h2>
                    <p className="text-sm text-gray-500">ใบลาคงค้างของพนักงานในทีมที่รอรับการอนุมัติ</p>
                </div>
            </div>

            <PendingApprovalList
                pending={model.pending}
                isProcessing={model.isProcessing}
                onApprove={model.approveLeave}
                onOpenReject={model.openRejectDialog}
            />

            <div className="mt-12">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">ประวัติการพิจารณา</h2>
                <ApprovalHistoryList history={model.history} />
            </div>

            <RejectLeaveDialog
                open={model.isRejectDialogOpen}
                selectedLeave={model.selectedLeave}
                rejectReason={model.rejectReason}
                isProcessing={model.isProcessing}
                onOpenChange={(open) => {
                    if (!open) {
                        model.closeRejectDialog();
                    }
                }}
                onRejectReasonChange={model.setRejectReason}
                onConfirmReject={model.rejectLeave}
            />
        </div>
    );
}
