"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Download, Loader2, Upload, Plus, Users } from "lucide-react";
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
        <div className="relative min-h-[calc(100dvh-6rem)] overflow-hidden rounded-3xl border border-content-on-brand/60 bg-surface-subtle/50 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="employee-management-glow-info absolute right-0 top-0 h-[800px] w-[800px] -translate-y-1/2 translate-x-1/3" />
                <div className="employee-management-glow-accent absolute bottom-0 left-0 h-[1000px] w-[1000px] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {/* Header */}
                <div className="flex min-w-0 flex-col justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out lg:flex-row lg:items-center">
                    <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                        <div className="relative group cursor-default">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-sky-500/40 to-blue-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 shadow-lg shadow-sky-500/25 ring-1 ring-content-on-brand/20">
                                <Users className="h-7 w-7 text-content-on-brand" />
                            </div>
                        </div>
                        <div className="min-w-0 space-y-1">
                            <h1
                                data-page-heading
                                tabIndex={-1}
                                className="text-2xl font-bold leading-tight tracking-tight text-content-heading [overflow-wrap:anywhere] sm:text-3xl"
                            >
                                {isAdmin ? "จัดการพนักงาน" : "ข้อมูลพนักงาน"}
                            </h1>
                            <p className="text-content-neutral-muted font-medium">
                                {isAdmin
                                    ? "จัดการข้อมูลพนักงานและสิทธิ์การเข้าถึง"
                                    : "ดูข้อมูลพนักงานในองค์กร"}
                            </p>
                        </div>
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
                                className="w-full justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-content-on-brand shadow-md shadow-indigo-500/25 transition-[transform,background-color,box-shadow] duration-300 hover:from-indigo-700 hover:to-blue-700 hover:shadow-lg motion-safe:hover:-translate-y-0.5 sm:w-auto"
                            >
                                <Plus className="h-4 w-4" />
                                <span>เพิ่มพนักงาน</span>
                            </Button>
                        </div>
                    )}
                </div>

                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    <EmployeeStatsCards stats={employeeStats} />

                    <div className="rounded-2xl bg-surface/95 p-1 shadow-lg ring-1 ring-surface-neutral-border">
                        <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="rounded-t-2xl border-b border-border-neutral-muted bg-surface-neutral-subtle/50 px-6 py-5">
                                <CardTitle className="text-xl font-bold tracking-tight text-content-neutral-primary">รายชื่อพนักงาน</CardTitle>
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
