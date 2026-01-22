"use client";

import { ImportEmployeeCSV } from "@/components/employee";
import { useTitle } from "@/hooks/useTitle";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

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

    const { selectedMenu, handleMenuClick } = useDashboardUIContext();
    const { handleEmployeeAdded } = useDashboardDataContext();

    const renderContent = () => {
        switch (selectedMenu) {
            case "it-equipment":
                return <ITEquipmentSection />;

            case "it-support":
                return <ITSupportSection />;

            case "email-request":
                return <EmailRequestSection />;

            case "employee-management":
                return <EmployeeManagementSection />;

            case "add-employee":
                return <AddEmployeeSection />;

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
                return <DashboardHomeSection />;
        }
    };

    return renderContent();
}
