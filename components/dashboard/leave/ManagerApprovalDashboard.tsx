"use client";

import type { ReactElement } from "react";

import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import { PendingApprovalList } from "./_components/PendingApprovalList";
import { ApprovalHistoryList } from "./_components/ApprovalHistoryList";
import { RejectLeaveDialog } from "./_components/RejectLeaveDialog";
import { ApprovalConfirmDialog } from "./_components/ApprovalConfirmDialog";
import { NotTakenPendingList } from "./_components/NotTakenPendingList";
import { CancellationPendingList } from "./_components/CancellationPendingList";
import {
    ApprovalPagination,
    ApprovalSectionHeader,
} from "./_components/ApprovalDashboardPrimitives";
import { ManagerApprovalDashboardSkeleton } from "./LeaveSkeletons";

export function ManagerApprovalDashboard(): ReactElement {
    const model = useManagerApprovalModel();

    if (model.isLoading) {
        return <ManagerApprovalDashboardSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <ApprovalSectionHeader
                    title="รายการรอพิจารณา"
                    description="คำขอลาคงค้างของพนักงานที่รอรับการอนุมัติจากคุณ"
                    count={model.metadata?.pending.totalItems ?? model.pending.length}
                    tone="attention"
                />
                <PendingApprovalList
                    pending={model.pending}
                    isProcessing={model.isProcessing}
                    onApprove={model.approveLeave}
                    onOpenReject={model.openRejectDialog}
                />
                <ApprovalPagination
                    metadata={model.metadata?.pending}
                    onPageChange={model.setPendingPage}
                />
            </div>

            <div className="space-y-3">
                <ApprovalSectionHeader
                    title="รายการรอยืนยันไม่ได้ใช้วันลา"
                    description="เมื่อยืนยันแล้วระบบจะคืนโควต้าตามวันลาสุทธิของคำขอเดิม"
                    count={model.metadata?.notTakenPending.totalItems ?? model.notTakenPending.length}
                    tone="info"
                />
                <NotTakenPendingList
                    items={model.notTakenPending}
                    isProcessing={model.isProcessing}
                    onConfirm={model.confirmNotTaken}
                />
                <ApprovalPagination
                    metadata={model.metadata?.notTakenPending}
                    onPageChange={model.setNotTakenPage}
                />
            </div>

            <div className="space-y-3 pt-2">
                <ApprovalSectionHeader
                    title="รายการรอยืนยันยกเลิกวันลา"
                    description="ยืนยันเพื่อยกเลิกและคืนโควต้า หรือปิดคำขอเพื่อคงสถานะอนุมัติเดิม"
                    count={model.metadata?.cancellationPending.totalItems ?? model.cancellationPending.length}
                    tone="attention"
                />
                <CancellationPendingList
                    items={model.cancellationPending}
                    isProcessing={model.isProcessing}
                    onConfirm={model.confirmCancellation}
                    onReject={model.rejectCancellation}
                />
                <ApprovalPagination
                    metadata={model.metadata?.cancellationPending}
                    onPageChange={model.setCancellationPage}
                />
            </div>

            <div className="space-y-3 pt-2">
                <ApprovalSectionHeader
                    title="ประวัติการพิจารณา"
                    description="รายการที่มีการตัดสินใจแล้ว"
                    count={model.metadata?.history.totalItems ?? model.history.length}
                    tone="neutral"
                />
                <ApprovalHistoryList history={model.history} />
                <ApprovalPagination
                    metadata={model.metadata?.history}
                    onPageChange={model.setHistoryPage}
                />
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

            <ApprovalConfirmDialog
                leave={model.approvalConfirmLeave}
                isProcessing={model.isProcessing}
                onOpenChange={(open) => {
                    if (!open) {
                        model.closeApprovalConfirmDialog();
                    }
                }}
                onConfirm={model.confirmApproveLeave}
            />
        </div>
    );
}
