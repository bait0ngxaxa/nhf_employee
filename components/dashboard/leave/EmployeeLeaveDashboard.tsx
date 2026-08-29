"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import { useEmployeeLeaveDashboardModel } from "@/hooks/leave/useEmployeeLeaveDashboardModel";
import { LeaveQuotaCards } from "./_components/LeaveQuotaCards";
import { EmployeeLeaveHistoryList } from "./_components/EmployeeLeaveHistoryList";
import { CancelLeaveDialog } from "./_components/CancelLeaveDialog";
import { NotTakenRequestDialog } from "./_components/NotTakenRequestDialog";
import { EmployeeLeaveDashboardSkeleton } from "./LeaveSkeletons";

export function EmployeeLeaveDashboard() {
    const model = useEmployeeLeaveDashboardModel();

    if (model.isLoading) {
        return <EmployeeLeaveDashboardSkeleton />;
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
                <Button className={LEAVE_THEME_BUTTON_CLASS} onClick={model.openRequestForm}>
                    <Plus data-icon="inline-start" /> ยื่นคำขอลา
                </Button>
            </div>

            <LeaveRequestForm
                open={model.isRequestFormOpen}
                onSuccess={model.onRequestSuccess}
                onCancel={model.closeRequestForm}
                quotas={model.quotas}
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
                <EmployeeLeaveHistoryList
                    history={model.history}
                    metadata={model.metadata}
                    isSubmitting={model.isSubmitting}
                    onCancelRequest={model.openCancelDialog}
                    onNotTakenRequest={model.openNotTakenDialog}
                    onPageChange={model.setPage}
                />
            </div>

            <CancelLeaveDialog
                open={model.cancelConfirmRequest !== null}
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
                open={model.notTakenRequestId !== null}
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
