"use client";

import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { useEmployeeLeaveDashboardModel } from "@/hooks/leave/useEmployeeLeaveDashboardModel";
import { LeaveQuotaCards } from "./_components/LeaveQuotaCards";
import { EmployeeLeaveHistoryList } from "./_components/EmployeeLeaveHistoryList";
import { CancelLeaveDialog } from "./_components/CancelLeaveDialog";

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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">โควต้าวันลาของคุณ</h2>
                <Button onClick={model.openRequestForm} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> ยื่นใบลา
                </Button>
            </div>

            {model.isRequestFormOpen ? (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                    <LeaveRequestForm onSuccess={model.onRequestSuccess} onCancel={model.closeRequestForm} />
                </div>
            ) : null}

            <LeaveQuotaCards
                sickQuota={model.sickQuota}
                personalQuota={model.personalQuota}
                vacationQuota={model.vacationQuota}
            />

            <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">ประวัติการลา (ล่าสุด)</h2>
                <EmployeeLeaveHistoryList
                    history={model.history}
                    metadata={model.metadata}
                    isSubmitting={model.isSubmitting}
                    onCancelRequest={model.openCancelDialog}
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
        </div>
    );
}
