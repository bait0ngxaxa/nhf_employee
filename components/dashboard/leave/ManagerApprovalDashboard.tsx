"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/Pagination";
import { cn } from "@/lib/ui/utils";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import type { LeaveApprovalPaginationMetadata } from "@/hooks/useLeaveApprovals";
import { PendingApprovalList } from "./_components/PendingApprovalList";
import { ApprovalHistoryList } from "./_components/ApprovalHistoryList";
import { RejectLeaveDialog } from "./_components/RejectLeaveDialog";
import { ApprovalConfirmDialog } from "./_components/ApprovalConfirmDialog";
import { NotTakenPendingList } from "./_components/NotTakenPendingList";

export function ManagerApprovalDashboard() {
    const model = useManagerApprovalModel();

    if (model.isLoading) {
        return <ManagerApprovalDashboardSkeleton />;
    }

    return (
        <div className="space-y-6">
            <ApprovalSectionHeader
                title="รายการรอพิจารณา"
                description="คำขอลาคงค้างของพนักงานในทีมที่รอรับการอนุมัติ"
                count={model.metadata?.pending.totalItems ?? model.pending.length}
                tone="attention"
            />

            <div className="space-y-3">
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

function ApprovalPagination({
    metadata,
    onPageChange,
}: {
    metadata?: LeaveApprovalPaginationMetadata;
    onPageChange: (page: number) => void;
}) {
    if (!metadata || metadata.totalPages <= 1) {
        return null;
    }

    return (
        <div className="pt-1">
            <Pagination
                currentPage={metadata.currentPage}
                totalPages={metadata.totalPages}
                itemsPerPage={metadata.itemsPerPage}
                onPageChange={onPageChange}
                onPreviousPage={() => onPageChange(Math.max(1, metadata.currentPage - 1))}
                onNextPage={() => onPageChange(Math.min(metadata.totalPages, metadata.currentPage + 1))}
            />
        </div>
    );
}

function ApprovalSectionHeader({
    title,
    description,
    count,
    tone,
}: {
    title: string;
    description: string;
    count: number;
    tone: "attention" | "info" | "neutral";
}) {
    const toneClassName = {
        attention: "border-indigo-100 bg-indigo-50 text-indigo-700",
        info: "border-cyan-100 bg-cyan-50 text-cyan-800",
        neutral: "border-slate-200 bg-slate-50 text-slate-700",
    }[tone];

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h2 className="text-xl/7 font-semibold tracking-tight text-slate-950">{title}</h2>
                <p className="mt-1 max-w-2xl text-sm/6 text-slate-600">{description}</p>
            </div>
            <span className={cn("w-fit rounded-full border px-3 py-1 text-sm font-medium", toneClassName)}>
                {count} รายการ
            </span>
        </div>
    );
}

function ManagerApprovalDashboardSkeleton() {
    return (
        <div className="space-y-6" aria-label="กำลังโหลดรายการอนุมัติการลา">
            <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            {[1, 2].map((item) => (
                <Skeleton key={item} className="h-44 rounded-xl" />
            ))}
            <div className="space-y-3">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-24 rounded-xl" />
            </div>
        </div>
    );
}
