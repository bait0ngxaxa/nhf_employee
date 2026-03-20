"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Download, Upload, Plus, Users } from "lucide-react";
import { CSVLink } from "react-csv";
import { EmployeeStatsCards, EmployeeList } from "@/components/employee";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import {
    useEmployeeDataContext,
    useEmployeeUIContext,
    EmployeeProvider,
} from "./context";

function EmployeeManagementContent() {
    const { handleMenuClick } = useDashboardUIContext();
    const { employeeStats, user, isAdmin } = useDashboardDataContext();
    const { employees, refreshTrigger } = useEmployeeDataContext();
    const { isExporting, getExportData, getExportFileName, handleExportCSV } =
        useEmployeeUIContext();

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(219,234,254,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(207,250,254,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <div className="flex items-center space-x-5">
                        <div className="relative group cursor-default">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-sky-500/40 to-blue-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                            <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-sky-600 to-blue-700 rounded-2xl shadow-lg shadow-sky-500/25 ring-1 ring-white/20">
                                <Users className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                                {isAdmin ? "จัดการพนักงาน" : "ข้อมูลพนักงาน"}
                            </h2>
                            <p className="text-gray-500 font-medium">
                                {isAdmin
                                    ? "จัดการข้อมูลพนักงานและสิทธิ์การเข้าถึง"
                                    : "ดูข้อมูลพนักงานในองค์กร"}
                            </p>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="flex flex-wrap items-center gap-3">
                            {employees.length > 0 && (
                                <CSVLink
                                    data={getExportData()}
                                    filename={getExportFileName()}
                                    className="inline-flex"
                                    onClick={handleExportCSV}
                                >
                                    <Button
                                        variant="outline"
                                        className="flex items-center space-x-2 bg-white/95 hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm rounded-xl"
                                        disabled={isExporting}
                                    >
                                        <Download className="h-4 w-4" />
                                        <span>
                                            {isExporting
                                                ? "กำลังเตรียมข้อมูล..."
                                                : "Export CSV"}
                                        </span>
                                    </Button>
                                </CSVLink>
                            )}
                            <Button
                                onClick={() => handleMenuClick("import-employee")}
                                variant="outline"
                                className="flex items-center space-x-2 bg-white/95 hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm rounded-xl"
                            >
                                <Upload className="h-4 w-4" />
                                <span>นำเข้า CSV</span>
                            </Button>
                            <Button
                                onClick={() => handleMenuClick("add-employee")}
                                className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-500/25 transition-[transform,background-color,box-shadow] duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5 rounded-xl"
                            >
                                <Plus className="h-4 w-4" />
                                <span>เพิ่มพนักงาน</span>
                            </Button>
                        </div>
                    )}
                </div>

                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    <EmployeeStatsCards stats={employeeStats} />

                    <div className="bg-white/95 rounded-2xl shadow-lg ring-1 ring-gray-200 p-1">
                        <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="border-b border-gray-100 bg-gray-50/50 px-6 py-5 rounded-t-2xl">
                                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">รายชื่อพนักงาน</CardTitle>
                                <CardDescription className="text-gray-500 mt-1">
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
