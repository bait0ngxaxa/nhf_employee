"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Menu,
    X,
    User,
    Users,
    Settings,
    LogOut,
    Plus,
    Download,
    Upload,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { AddEmployeeForm } from "@/components/AddEmployeeForm";
import { EmployeeList } from "@/components/EmployeeList";
import { ImportEmployeeCSV } from "@/components/ImportEmployeeCSV";
import { CSVLink } from "react-csv";
import { useTitle } from "@/hook/useTitle";
import ITIssuesPage from "@/app/it-issues/page";
import { Employee } from "@/types/employees";
import {
    DASHBOARD_MENU_ITEMS,
    getAvailableMenuItems,
} from "@/constants/dashboard";
import { useEmployeeExport } from "@/hooks/useEmployeeExport";
import { EmailRequestForm } from "@/components/EmailRequestForm";

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const [selectedMenu, setSelectedMenu] = useState<string>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [employeeStats, setEmployeeStats] = useState({
        total: 0,
        active: 0,
        admin: 0,
        academic: 0,
    });
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const {
        allEmployees,
        setAllEmployees,
        isExporting,
        setIsExporting,
        prepareCsvData,
        generateFileName,
    } = useEmployeeExport();
    const router = useRouter();
    const user = session?.user;
    const isAdmin = user?.role === "ADMIN";
    useTitle("Dashboard | NHF IT System");

    // Fetch employee statistics
    const fetchEmployeeStats = useCallback(async () => {
        if (isAdmin) {
            try {
                const response = await fetch("/api/employees");
                if (response.ok) {
                    const data = await response.json();
                    const employees: Employee[] = data.employees;

                    // Store all employees for CSV export
                    setAllEmployees(employees);

                    const stats = {
                        total: employees.length,
                        active: employees.filter(
                            (emp: Employee) => emp.status === "ACTIVE"
                        ).length,
                        admin: employees.filter(
                            (emp: Employee) => emp.dept.code === "ADMIN"
                        ).length,
                        academic: employees.filter(
                            (emp: Employee) => emp.dept.code === "ACADEMIC"
                        ).length,
                    };

                    setEmployeeStats(stats);
                }
            } catch (error) {
                console.error("Error fetching employee stats:", error);
            }
        }
    }, [isAdmin, setAllEmployees]);

    // Fetch stats on component mount and when refreshTrigger changes
    useEffect(() => {
        fetchEmployeeStats();
    }, [fetchEmployeeStats, refreshTrigger]);

    const handleEmployeeAdded = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (status === "unauthenticated" || !session) {
        router.push("/login");
        return null;
    }

    // Get available menu items based on user role
    const availableMenuItems = getAvailableMenuItems(isAdmin);

    const handleMenuClick = (menuId: string) => {
        const menuItem = DASHBOARD_MENU_ITEMS.find(
            (item) => item.id === menuId
        );
        if (menuItem?.requiredRole === "ADMIN" && !isAdmin) {
            window.location.href = "/access-denied";
            return;
        }

        setSelectedMenu(menuId);

        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    const handleSignOut = () => {
        signOut({ callbackUrl: "/login" });
    };

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            await fetchEmployeeStats();
        } catch (error) {
            console.error("Error preparing export:", error);
        } finally {
            setIsExporting(false);
        }
    };

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
                                onCancel={() => setSelectedMenu("dashboard")}
                                onSuccess={() => setSelectedMenu("dashboard")}
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

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                            <Card className="bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                        พนักงานทั้งหมด
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline space-x-2">
                                        <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                                            {employeeStats.total}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            คน
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                        พนักงานปัจจุบัน
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline space-x-2">
                                        <p className="text-4xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                                            {employeeStats.active}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            คน (Active)
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                        แผนกบริหาร
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline space-x-2">
                                        <p className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
                                            {employeeStats.admin}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            คน
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                        แผนกวิชาการ
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline space-x-2">
                                        <p className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent">
                                            {employeeStats.academic}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            คน
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

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
            <div
                className={cn(
                    "bg-white/80 backdrop-blur-xl shadow-lg border-r border-gray-200/50 transition-all duration-300 flex flex-col z-20",
                    sidebarOpen ? "w-64" : "w-16"
                )}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        {sidebarOpen && (
                            <h1 className="text-xl font-bold text-gray-800">
                                ระบบจัดการ
                            </h1>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            {sidebarOpen ? (
                                <X className="h-4 w-4" />
                            ) : (
                                <Menu className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    <Button
                        variant={
                            selectedMenu === "dashboard" ? "default" : "ghost"
                        }
                        className={cn(
                            "w-full justify-start",
                            selectedMenu === "dashboard"
                                ? "bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 border-r-4 border-blue-600 shadow-sm"
                                : "hover:bg-gray-50 text-gray-600 hover:text-gray-900",
                            !sidebarOpen && "justify-center px-2"
                        )}
                        onClick={() => handleMenuClick("dashboard")}
                    >
                        <Settings className="h-4 w-4" />
                        {sidebarOpen && <span className="ml-2">แดชบอร์ด</span>}
                    </Button>

                    <Separator className="my-2" />

                    {availableMenuItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                            <Button
                                key={item.id}
                                variant={
                                    selectedMenu === item.id
                                        ? "default"
                                        : "ghost"
                                }
                                className={cn(
                                    "w-full justify-start",
                                    selectedMenu === item.id
                                        ? "bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 border-r-4 border-blue-600 shadow-sm"
                                        : "hover:bg-gray-50 text-gray-600 hover:text-gray-900",
                                    !sidebarOpen && "justify-center px-2"
                                )}
                                onClick={() => handleMenuClick(item.id)}
                            >
                                <IconComponent className="h-4 w-4" />
                                {sidebarOpen && (
                                    <span className="ml-2">{item.label}</span>
                                )}
                            </Button>
                        );
                    })}
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-gray-100">
                    {sidebarOpen && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-600" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {user?.name}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {user?.email}
                                    </p>
                                    <p className="text-xs text-blue-600">
                                        {user?.role === "ADMIN"
                                            ? "ผู้ดูแลระบบ"
                                            : "ผู้ใช้งาน"}{" "}
                                        | {user?.department}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full text-red-600 hover:text-red-700 hover:bg-red-50",
                            sidebarOpen
                                ? "justify-start"
                                : "justify-center px-2"
                        )}
                        onClick={handleSignOut}
                    >
                        <LogOut className="h-4 w-4" />
                        {sidebarOpen && (
                            <span className="ml-2">ออกจากระบบ</span>
                        )}
                    </Button>
                </div>
            </div>

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
