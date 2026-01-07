"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Menu, Plus, Download, Upload, Users } from "lucide-react";
import { AddEmployeeForm } from "@/components/AddEmployeeForm";
import { EmployeeList } from "@/components/EmployeeList";
import { ImportEmployeeCSV } from "@/components/ImportEmployeeCSV";
import { CSVLink } from "react-csv";
import { useTitle } from "@/hook/useTitle";
import ITIssuesPage from "@/app/it-issues/page";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { EmployeeStatsCards } from "@/components/EmployeeStatsCards";
import { EmailRequestForm } from "@/components/EmailRequestForm";
import { useDashboard } from "@/hooks/useDashboard";

export default function DashboardPage() {
    useTitle("Dashboard | NHF IT System");

    const {
        status,
        user,
        selectedMenu,
        sidebarOpen,
        setSidebarOpen,
        availableMenuItems,
        handleMenuClick,
        handleSignOut,
        employeeStats,
        refreshTrigger,
        handleEmployeeAdded,
        allEmployees,
        isExporting,
        prepareCsvData,
        generateFileName,
        handleExportCSV,
        router,
    } = useDashboard();

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (status === "unauthenticated") {
        router.push("/login");
        return null;
    }

    const renderContent = () => {
        switch (selectedMenu) {
            case "it-equipment":
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                ครุภัณฑ์ไอที
                            </h2>
                            <p className="text-gray-600">
                                จัดการและติดตามครุภัณฑ์ไอที
                            </p>
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle>ครุภัณฑ์ไอทีของฉัน</CardTitle>
                                <CardDescription>
                                    รายการครุภัณฑ์ที่ได้รับมอบหมาย
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-700">
                                    กำลังอยู่ในช่วงพัฒนา
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                );

            case "it-support":
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                แจ้งปัญหาไอที
                            </h2>
                            <p className="text-gray-600">
                                แจ้งปัญหาและขอรับการซ่อมแซม
                            </p>
                        </div>
                        <ITIssuesPage />
                    </div>
                );

            case "email-request":
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                ขออีเมลพนักงานใหม่
                            </h2>
                            <p className="text-gray-600">
                                ส่งคำขออีเมลสำหรับพนักงานใหม่ให้ทีมไอที
                            </p>
                        </div>
                        <div className="space-y-6">
                            <EmailRequestForm
                                onCancel={() => handleMenuClick("dashboard")}
                                onSuccess={() => handleMenuClick("dashboard")}
                            />
                        </div>
                    </div>
                );

            case "employee-management":
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
                                    onClick={() =>
                                        handleMenuClick("import-employee")
                                    }
                                    variant="outline"
                                    className="flex items-center space-x-2"
                                >
                                    <Upload className="h-4 w-4" />
                                    <span>นำเข้า CSV</span>
                                </Button>
                                <Button
                                    onClick={() =>
                                        handleMenuClick("add-employee")
                                    }
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

            case "add-employee":
                return (
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    handleMenuClick("employee-management")
                                }
                                className="flex items-center space-x-2"
                            >
                                <Users className="h-4 w-4" />
                                <span>กลับไปรายชื่อ</span>
                            </Button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    เพิ่มพนักงานใหม่
                                </h2>
                                <p className="text-gray-600">
                                    เพิ่มข้อมูลพนักงานใหม่เข้าระบบ
                                </p>
                            </div>
                        </div>
                        <AddEmployeeForm onSuccess={handleEmployeeAdded} />
                    </div>
                );

            case "import-employee":
                return (
                    <ImportEmployeeCSV
                        onSuccess={handleEmployeeAdded}
                        onBack={() => handleMenuClick("employee-management")}
                    />
                );

            default:
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                ยินดีต้อนรับ, {user?.name}
                            </h2>
                            <p className="text-gray-600">ระบบจัดการพนักงาน</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {availableMenuItems.map((item) => {
                                const IconComponent = item.icon;
                                return (
                                    <Card
                                        key={item.id}
                                        className="cursor-pointer bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 rounded-2xl group"
                                        onClick={() => handleMenuClick(item.id)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-center space-x-4">
                                                <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors duration-300">
                                                    <IconComponent className="h-8 w-8 text-blue-600" />
                                                </div>
                                                <CardTitle className="text-xl group-hover:text-blue-700 transition-colors">
                                                    {item.label}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="text-base">
                                                {item.description}
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Sidebar */}
            <DashboardSidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                selectedMenu={selectedMenu}
                onMenuClick={handleMenuClick}
                menuItems={availableMenuItems}
                user={user}
                onSignOut={handleSignOut}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-3xl"></div>
                </div>

                {/* Mobile Menu Button */}
                <div className="md:hidden p-4 border-b border-gray-200/50 bg-white/60 backdrop-blur-md">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <Menu className="h-4 w-4" />
                        <span className="ml-2">เมนู</span>
                    </Button>
                </div>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}
