"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Download, Loader2, Upload, Plus } from "lucide-react";
import { EmployeeStatsCards, EmployeeList } from "@/components/employee";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import {
    useEmployeeDataContext,
    useEmployeeUIContext,
} from "@/components/dashboard/context/employee/EmployeeContext";
import { EmployeeProvider } from "@/components/dashboard/context/employee/EmployeeProvider";

function EmployeeManagementContent() {
    const { handleMenuClick } = useDashboardUIContext();
    const { employeeStats, user, isAdmin } = useDashboardDataContext();
    const { employees, refreshTrigger } = useEmployeeDataContext();
    const { isExporting, handleExportCSV } = useEmployeeUIContext();

    return (
        <div className="min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle">
            <div className="min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <header className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 space-y-1">
                        <h1
                            data-page-heading
                            tabIndex={-1}
                            className="text-2xl font-bold leading-tight tracking-tight text-content-heading [overflow-wrap:anywhere] sm:text-3xl"
                        >
                            {isAdmin ? "จัดการพนักงาน" : "ข้อมูลพนักงาน"}
                        </h1>
                        <p className="font-medium text-content-neutral-muted">
                            {isAdmin
                                ? "จัดการข้อมูลพนักงานและสิทธิ์การเข้าถึง"
                                : "ดูข้อมูลพนักงานในองค์กร"}
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
                            {employees.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="w-full justify-center rounded-xl border-border-neutral-default bg-surface/95 text-content-neutral-body shadow-sm hover:bg-surface-neutral-subtle sm:w-auto"
                                    disabled={isExporting}
                                    onClick={() => void handleExportCSV()}
                                >
                                    {isExporting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    <span>
                                        {isExporting
                                            ? "กำลังเตรียมข้อมูล..."
                                            : "Export CSV"}
                                    </span>
                                </Button>
                            )}
                            <Button
                                onClick={() => handleMenuClick("import-employee")}
                                variant="outline"
                                className="w-full justify-center rounded-xl border-border-neutral-default bg-surface/95 text-content-neutral-body shadow-sm hover:bg-surface-neutral-subtle sm:w-auto"
                            >
                                <Upload className="h-4 w-4" />
                                <span>นำเข้า CSV</span>
                            </Button>
                            <Button
                                onClick={() => handleMenuClick("add-employee")}
                                className="w-full justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-content-on-brand hover:from-indigo-700 hover:to-blue-700 sm:w-auto"
                            >
                                <Plus className="h-4 w-4" />
                                <span>เพิ่มพนักงาน</span>
                            </Button>
                        </div>
                    )}
                </header>

                <div className="space-y-8">
                    <EmployeeStatsCards stats={employeeStats} />

                    <Card className="gap-0 overflow-hidden border-border-neutral-default p-0 shadow-none">
                        <CardHeader className="border-b border-border-neutral-muted bg-surface-neutral-subtle/50 px-6 py-5">
                            <CardTitle className="text-xl font-bold tracking-tight text-content-neutral-primary">
                                รายชื่อพนักงาน
                            </CardTitle>
                            <CardDescription className="mt-1 text-content-neutral-muted">
                                รายชื่อพนักงานทั้งหมดในระบบ
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <EmployeeList
                                refreshTrigger={refreshTrigger}
                                userRole={user?.role}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export function EmployeeManagementSection() {
    return (
        <EmployeeProvider>
            <EmployeeManagementContent />
        </EmployeeProvider>
    );
}
