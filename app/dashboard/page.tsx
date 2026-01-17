"use client";

import { Button } from "@/components/ui/button";
import { ImportEmployeeCSV } from "@/components/employee";
import { useTitle } from "@/hooks/useTitle";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { Menu } from "lucide-react";

// Dashboard Sections
import {
    ITEquipmentSection,
    ITSupportSection,
    EmailRequestSection,
    EmployeeManagementSection,
    AddEmployeeSection,
    AuditLogsSection,
    DashboardHomeSection,
} from "@/components/dashboard";

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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
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
                return <ITEquipmentSection />;

            case "it-support":
                return <ITSupportSection />;

            case "email-request":
                return (
                    <EmailRequestSection
                        onCancel={() => handleMenuClick("dashboard")}
                        onSuccess={() => handleMenuClick("dashboard")}
                    />
                );

            case "employee-management":
                return (
                    <EmployeeManagementSection
                        allEmployees={allEmployees}
                        prepareCsvData={prepareCsvData}
                        generateFileName={generateFileName}
                        handleExportCSV={handleExportCSV}
                        isExporting={isExporting}
                        handleMenuClick={handleMenuClick}
                        employeeStats={employeeStats}
                        refreshTrigger={refreshTrigger}
                        user={user}
                    />
                );

            case "add-employee":
                return (
                    <AddEmployeeSection
                        handleMenuClick={handleMenuClick}
                        onSuccess={handleEmployeeAdded}
                    />
                );

            case "import-employee":
                return (
                    <ImportEmployeeCSV
                        onSuccess={handleEmployeeAdded}
                        onBack={() => handleMenuClick("employee-management")}
                    />
                );

            case "audit-logs":
                return <AuditLogsSection />;

            default:
                return (
                    <DashboardHomeSection
                        user={user}
                        availableMenuItems={availableMenuItems}
                        handleMenuClick={handleMenuClick}
                    />
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
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-3xl" />
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
