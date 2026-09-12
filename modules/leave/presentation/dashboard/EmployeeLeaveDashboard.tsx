"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_LEAVE_STATUSES } from "../../domain/constants";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import { useEmployeeLeaveDashboardModel } from "./hooks/useEmployeeLeaveDashboardModel";
import { LeaveQuotaCards } from "./components/LeaveQuotaCards";
import { EmployeeLeaveHistoryList } from "./components/EmployeeLeaveHistoryList";
import { LeaveHistoryFilters } from "./components/LeaveHistoryFilters";
import { CancelLeaveDialog } from "./components/CancelLeaveDialog";
import { NotTakenRequestDialog } from "./components/NotTakenRequestDialog";
import { EmployeeLeaveDashboardSkeleton } from "./LeaveSkeletons";
import type { LeavePresentationCapabilities } from "../../application/types";

interface EmployeeLeaveDashboardProps {
    leaveCapabilities?: LeavePresentationCapabilities;
}

export function EmployeeLeaveDashboard({
    leaveCapabilities,
}: EmployeeLeaveDashboardProps) {
    const model = useEmployeeLeaveDashboardModel(leaveCapabilities);

    if (model.isLoading) {
        return <EmployeeLeaveDashboardSkeleton />;
    }

    if (!model.canReadOwnRequests) {
        return (
            <div
                className="border-y border-status-warning-border bg-status-warning-surface px-4 py-5 text-sm leading-6 text-status-warning-strong"
                role="status"
            >
                บัญชีนี้ยังไม่มีสิทธิ์ดูข้อมูลวันลาของตนเอง
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm/6 font-medium text-module-leave-badge-foreground">วันลาของฉัน</p>
                    <h2 className="mt-1 text-xl/7 font-semibold tracking-tight text-content-heading">
                        โควต้าวันลาของคุณ
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm/6 text-content-secondary">
                        ดูสิทธิ์คงเหลือก่อนยื่นคำขอใหม่
                    </p>
                </div>
                {model.canCreateOwnRequests ? (
                    <Button className={LEAVE_THEME_BUTTON_CLASS} onClick={model.openRequestForm}>
                        <Plus data-icon="inline-start" /> ยื่นคำขอลา
                    </Button>
                ) : null}
            </div>

            <LeaveRequestForm
                open={model.isRequestFormOpen && model.canCreateOwnRequests}
                onSuccess={model.onRequestSuccess}
                onCancel={model.closeRequestForm}
                quotas={model.quotas}
                canCreateRequests={model.canCreateOwnRequests}
            />

            <LeaveQuotaCards
                sickQuota={model.sickQuota}
                personalQuota={model.personalQuota}
                vacationQuota={model.vacationQuota}
            />

            <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-xl/7 font-semibold tracking-tight text-content-heading">
                            ประวัติการลา
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm/6 text-content-secondary">
                            รายการล่าสุดพร้อมสถานะและการดำเนินการที่ยังทำได้
                        </p>
                    </div>
                    <span className="w-fit rounded-full border border-module-leave-badge-border bg-module-leave-badge-surface px-3 py-1 text-sm font-medium text-module-leave-badge-foreground">
                        {model.metadata?.totalItems ?? model.history.length} รายการ
                    </span>
                </div>
                <LeaveHistoryFilters
                    query={model.historyQuery}
                    queryPlaceholder="ค้นหาเหตุผลหรือรายละเอียด..."
                    queryLabel="ค้นหาประวัติการลา"
                    leaveType={model.historyLeaveType}
                    status={model.historyStatus}
                    year={model.historyYear}
                    yearOptions={model.metadata?.availableYears ?? []}
                    statusOptions={ALL_LEAVE_STATUSES}
                    hasActiveFilters={model.hasHistoryFilters}
                    onQueryChange={model.setHistoryQuery}
                    onLeaveTypeChange={model.setHistoryLeaveType}
                    onStatusChange={model.setHistoryStatus}
                    onYearChange={model.setHistoryYear}
                    onReset={model.resetHistoryFilters}
                />
                <EmployeeLeaveHistoryList
                    history={model.history}
                    metadata={model.metadata}
                    isFiltered={model.hasHistoryFilters}
                    isSubmitting={model.isSubmitting}
                    onCancelRequest={model.openCancelDialog}
                    onNotTakenRequest={model.openNotTakenDialog}
                    onPageChange={model.setPage}
                    canCancelOwnRequests={model.canCancelOwnRequests}
                    canRequestOwnNotTaken={model.canRequestOwnNotTaken}
                />
            </div>

            <CancelLeaveDialog
                open={model.cancelConfirmRequest !== null && model.canCancelOwnRequests}
                isSubmitting={model.isSubmitting}
                requiresApproval={model.cancelConfirmRequest?.status === "APPROVED"}
                reason={model.cancelReason}
                onReasonChange={model.setCancelReason}
                onOpenChange={(open) => {
                    if (!open) {
                        model.closeCancelDialog();
                    }
                }}
                onConfirm={model.confirmCancelLeave}
            />

            <NotTakenRequestDialog
                open={model.notTakenRequestId !== null && model.canRequestOwnNotTaken}
                note={model.notTakenNote}
                isSubmitting={model.isSubmitting}
                onNoteChange={model.setNotTakenNote}
                onOpenChange={(open) => {
                    if (!open) {
                        model.closeNotTakenDialog();
                    }
                }}
                onConfirm={model.confirmNotTakenRequest}
            />
        </div>
    );
}
