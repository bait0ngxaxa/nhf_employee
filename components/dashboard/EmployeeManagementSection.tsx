import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Download, Upload, Plus } from "lucide-react";
import { CSVLink } from "react-csv";
import { EmployeeStatsCards, EmployeeList } from "@/components/employee";
import { Employee, EmployeeCSVData } from "@/types/employees";

interface EmployeeStats {
    total: number;
    active: number;
    admin: number;
    academic: number;
}

interface User {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    department?: string;
    image?: string | null;
}

interface EmployeeManagementSectionProps {
    allEmployees: Employee[];
    prepareCsvData: () => EmployeeCSVData[];
    generateFileName: () => string;
    handleExportCSV: () => Promise<void>;
    isExporting: boolean;
    handleMenuClick: (menuId: string) => void;
    employeeStats: EmployeeStats;
    refreshTrigger: number;
    user: User | undefined;
}

export function EmployeeManagementSection({
    allEmployees,
    prepareCsvData,
    generateFileName,
    handleExportCSV,
    isExporting,
    handleMenuClick,
    employeeStats,
    refreshTrigger,
    user,
}: EmployeeManagementSectionProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        จัดการพนักงาน
                    </h2>
                    <p className="text-gray-600">
                        จัดการข้อมูลพนักงานและสิทธิ์การเข้าถึง
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    {allEmployees.length > 0 && (
                        <CSVLink
                            data={prepareCsvData()}
                            filename={generateFileName()}
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
