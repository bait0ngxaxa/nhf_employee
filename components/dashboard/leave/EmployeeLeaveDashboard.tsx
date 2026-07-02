"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import { useEmployeeLeaveDashboardModel } from "@/hooks/leave/useEmployeeLeaveDashboardModel";
import { LeaveQuotaCards } from "./_components/LeaveQuotaCards";
import { EmployeeLeaveHistoryList } from "./_components/EmployeeLeaveHistoryList";
import { CancelLeaveDialog } from "./_components/CancelLeaveDialog";
import { NotTakenRequestDialog } from "./_components/NotTakenRequestDialog";

export function EmployeeLeaveDashboard() {
    const model = useEmployeeLeaveDashboardModel();

    if (model.isLoading) {
        return <EmployeeLeaveDashboardSkeleton />;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm/6 font-medium text-indigo-700">วันลาของฉัน</p>
                    <h2 className="mt-1 text-xl/7 font-semibold tracking-tight text-slate-950">
                        โควต้าวันลาของคุณ
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm/6 text-slate-600">
                        ดูสิทธิ์คงเหลือก่อนยื่นคำขอใหม่
                    </p>
                </div>
                <Button className={LEAVE_THEME_BUTTON_CLASS} onClick={model.openRequestForm}>
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

            <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-xl/7 font-semibold tracking-tight text-slate-950">
                            ประวัติการลา
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm/6 text-slate-600">
                            รายการล่าสุดพร้อมสถานะและการดำเนินการที่ยังทำได้
                        </p>
                    </div>
                    <span className="w-fit rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
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

function EmployeeLeaveDashboardSkeleton() {
    return (
        <div className="space-y-6" aria-label="กำลังโหลดข้อมูลวันลา">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <Skeleton className="h-9 w-28" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-36 rounded-xl" />
                ))}
            </div>
            <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-24 rounded-xl" />
                ))}
            </div>
        </div>
    );
}
