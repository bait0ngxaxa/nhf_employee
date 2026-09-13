"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Upload, Plus } from "lucide-react";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { EmployeeList } from "./EmployeeList";
import { EmployeeStatsCards } from "./EmployeeStatsCards";
import { useEmployeeDataContext } from "./context/EmployeeContext";
import { EmployeeProvider } from "./context/EmployeeProvider";

function EmployeeManagementContent() {
    const { handleMenuClick } = useDashboardUIContext();
    const { user } = useDashboardDataContext();
    const { employeeStats, refreshTrigger } = useEmployeeDataContext();
    const employeeCapabilities = user?.employeeCapabilities;
    const canReadEmployees = employeeCapabilities?.canReadEmployees === true;
    const canReadStats = employeeCapabilities?.canReadStats === true;
    const canManageEmployees = [
        employeeCapabilities?.canCreateEmployees,
        employeeCapabilities?.canUpdateEmployees,
        employeeCapabilities?.canDeleteEmployees,
        employeeCapabilities?.canImportEmployees,
    ].some((capability) => capability === true);

    return (
        <div className="min-h-[calc(100dvh-6rem)]">
            <div className="min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <header className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 space-y-1">
                        <h1
                            data-page-heading
                            tabIndex={-1}
                            className="text-2xl font-bold leading-tight tracking-tight text-content-heading [overflow-wrap:anywhere] sm:text-3xl"
                        >
                            {canManageEmployees ? "จัดการพนักงาน" : "ข้อมูลพนักงาน"}
                        </h1>
                        <p className="font-medium text-content-neutral-muted">
                            {canManageEmployees
                                ? "จัดการข้อมูลพนักงานและสิทธิ์การเข้าถึง"
                                : "ดูข้อมูลพนักงานในองค์กร"}
                        </p>
                    </div>
                    {(employeeCapabilities?.canImportEmployees === true
                        || employeeCapabilities?.canCreateEmployees === true) && (
                        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
                            {employeeCapabilities?.canImportEmployees === true ? (
                                <Button
                                    onClick={() => handleMenuClick("import-employee")}
                                    variant="outline"
                                    className="w-full justify-center rounded-xl border-border-neutral-default bg-surface/95 text-content-neutral-body shadow-sm hover:bg-surface-neutral-subtle sm:w-auto"
                                >
                                    <Upload className="h-4 w-4" />
                                    <span>นำเข้า CSV</span>
                                </Button>
                            ) : null}
                            {employeeCapabilities?.canCreateEmployees === true ? (
                                <Button
                                    onClick={() => handleMenuClick("add-employee")}
                                    className="w-full justify-center rounded-xl bg-gradient-to-r from-employee-action-start to-employee-action-end text-content-on-brand hover:from-employee-action-hover-start hover:to-employee-action-hover-end sm:w-auto"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>เพิ่มพนักงาน</span>
                                </Button>
                            ) : null}
                        </div>
                    )}
                </header>

                <div className="space-y-8">
                    {canReadStats ? <EmployeeStatsCards stats={employeeStats} /> : null}

                    {canReadEmployees ? (
                        <Card className="gap-0 overflow-hidden rounded-xl border-border-neutral-default p-0 shadow-none">
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
                                    employeeCapabilities={employeeCapabilities}
                                />
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function EmployeeManagementSection() {
    const { user } = useDashboardDataContext();

    return (
        <EmployeeProvider employeeCapabilities={user?.employeeCapabilities}>
            <EmployeeManagementContent />
        </EmployeeProvider>
    );
}
