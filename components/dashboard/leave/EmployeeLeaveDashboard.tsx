"use client";

import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { useEmployeeLeaveDashboardModel } from "@/hooks/leave/useEmployeeLeaveDashboardModel";
import { LeaveQuotaCards } from "./_components/LeaveQuotaCards";
import { EmployeeLeaveHistoryList } from "./_components/EmployeeLeaveHistoryList";
import { CancelLeaveDialog } from "./_components/CancelLeaveDialog";
import { NotTakenRequestDialog } from "./_components/NotTakenRequestDialog";

export function EmployeeLeaveDashboard() {
    const model = useEmployeeLeaveDashboardModel();

    if (model.isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-gray-800">โควต้าวันลาของคุณ</h2>
                <Button onClick={model.openRequestForm}>
                    <Plus data-icon="inline-start" /> ยื่นใบลา
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

            <div className="mt-2">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">ประวัติการลา (ล่าสุด)</h2>
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
                open={model.cancelConfirmId !== null}
                isSubmitting={model.isSubmitting}
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
