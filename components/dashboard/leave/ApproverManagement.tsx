"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save } from "lucide-react";
import { useApproverManagementModel } from "@/hooks/leave/useApproverManagementModel";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import { ApproverStats } from "./_components/ApproverStats";
import { ApproverFilters } from "./_components/ApproverFilters";
import { ApproverTable } from "./_components/ApproverTable";
import { Pagination } from "@/components/Pagination";

export function ApproverManagement() {
    const model = useApproverManagementModel();

    if (model.isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((item) => (
                        <Skeleton key={item} className="h-20 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-12 rounded-xl" />
                {[1, 2, 3, 4, 5].map((item) => (
                    <Skeleton key={item} className="h-16 rounded-xl" />
                ))}
            </div>
        );
    }

    if (model.fetchError) {
        return (
            <Card className="border-rose-200 bg-rose-50 p-8 text-center shadow-none">
                <p className="text-sm font-medium text-rose-800">
                    ไม่สามารถโหลดข้อมูลผู้อนุมัติได้
                </p>
                <p className="mt-1 text-sm text-rose-700">
                    กรุณาลองรีเฟรชหน้าอีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <ApproverStats
                totalEmployees={model.employees.length}
                activeApprovers={model.activeApprovers.length}
                unassignedCount={model.unassignedCount}
            />

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="min-w-0">
                            <CardTitle className="text-lg text-slate-950">
                                กำหนดผู้อนุมัติ
                            </CardTitle>
                            <p className="mt-1 text-sm text-slate-600">
                                เลือกผู้อนุมัติการลาของพนักงานแต่ละคน
                            </p>
                        </div>
                        <Button
                            onClick={model.handleSave}
                            className={LEAVE_THEME_BUTTON_CLASS}
                            disabled={model.assignments.size === 0 || model.isSaving}
                        >
                            {model.isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Save className="h-4 w-4" aria-hidden="true" />
                            )}
                            บันทึก {model.assignments.size > 0 ? `(${model.assignments.size})` : ""}
                        </Button>
                    </div>

                    {model.saveMsg ? (
                        <div
                            role="status"
                            className={`px-4 py-2 rounded-lg text-sm mt-2 border ${
                                model.saveMsg.type === "ok"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-red-50 border-red-200 text-red-700"
                            }`}
                        >
                            {model.saveMsg.text}
                        </div>
                    ) : null}

                    <ApproverFilters
                        search={model.search}
                        filterApprover={model.filterApprover}
                        activeApprovers={model.activeApprovers}
                        formatName={model.formatName}
                        onSearchChange={model.setSearch}
                        onFilterChange={model.setFilterApprover}
                    />
                </CardHeader>

                <CardContent>
                    <ApproverTable
                        employees={model.pagedEmployees}
                        allEmployees={model.employees}
                        assignments={model.assignments}
                        noApproverValue={model.NO_APPROVER_VALUE}
                        formatName={model.formatName}
                        getManagerId={model.getManagerId}
                        onAssign={model.handleAssign}
                    />

                    <div className="mt-4">
                        <Pagination
                            currentPage={model.currentPage}
                            totalPages={model.totalPages}
                            itemsPerPage={model.itemsPerPage}
                            onPageChange={model.setCurrentPage}
                            onPreviousPage={model.handlePreviousPage}
                            onNextPage={model.handleNextPage}
                        />
                    </div>
                </CardContent>
            </Card>

            {model.assignments.size > 0 ? (
                <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-3xl -translate-x-1/2">
                    <div
                        role="status"
                        className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-white px-4 py-3 shadow-md"
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-indigo-700">
                                มีรายการที่ยังไม่บันทึก {model.assignments.size} รายการ
                            </p>
                            <p className="text-xs text-slate-600">
                                กดบันทึกเพื่ออัปเดตผู้อนุมัติลา
                            </p>
                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={model.transferPendingRequests}
                                    disabled={model.isSaving}
                                    onChange={(event) => model.setTransferPendingRequests(event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                                />
                                โอนคำขอที่ยังรออนุมัติไปยังผู้อนุมัติใหม่ด้วย
                            </label>
                        </div>
                        <Button
                            onClick={model.handleSave}
                            disabled={model.isSaving}
                            className={`shrink-0 ${LEAVE_THEME_BUTTON_CLASS}`}
                        >
                            {model.isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Save className="h-4 w-4" aria-hidden="true" />
                            )}
                            บันทึก ({model.assignments.size})
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
