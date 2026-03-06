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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/20 text-white">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {isAdmin ? "จัดการพนักงาน" : "ข้อมูลพนักงาน"}
                        </h2>
                        <p className="text-gray-600">
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
                                    className="flex items-center space-x-2"
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
                            className="flex items-center space-x-2"
                        >
                            <Upload className="h-4 w-4" />
                            <span>นำเข้า CSV</span>
                        </Button>
                        <Button
                            onClick={() => handleMenuClick("add-employee")}
                            className="flex items-center space-x-2"
                        >
                            <Plus className="h-4 w-4" />
                            <span>เพิ่มพนักงาน</span>
                        </Button>
                    </div>
                )}
            </div>

            <EmployeeStatsCards stats={employeeStats} />

            <Card>
                <CardHeader>
                    <CardTitle>รายชื่อพนักงาน</CardTitle>
                    <CardDescription>
                        รายชื่อพนักงานทั้งหมดในระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EmployeeList
                        refreshTrigger={refreshTrigger}
                        userRole={user?.role}
                    />
                </CardContent>
            </Card>
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
