"use client";

import dynamic from "next/dynamic";
import { ImportEmployeeCSV } from "@/components/employee";
import { useTitle } from "@/hooks/useTitle";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

// Dynamically import Dashboard Sections for code splitting
const ITEquipmentSection = dynamic(
    () =>
        import("@/components/dashboard").then((mod) => mod.ITEquipmentSection),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);
const ITSupportSection = dynamic(
    () => import("@/components/dashboard").then((mod) => mod.ITSupportSection),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);
const EmailRequestSection = dynamic(
    () =>
        import("@/components/dashboard").then((mod) => mod.EmailRequestSection),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);
const EmployeeManagementSection = dynamic(
    () =>
        import("@/components/dashboard").then(
            (mod) => mod.EmployeeManagementSection,
        ),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);
const AddEmployeeSection = dynamic(
    () =>
        import("@/components/dashboard").then((mod) => mod.AddEmployeeSection),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);
const AuditLogsSection = dynamic(
    () => import("@/components/dashboard").then((mod) => mod.AuditLogsSection),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);
const DashboardHomeSection = dynamic(
    () =>
        import("@/components/dashboard").then(
            (mod) => mod.DashboardHomeSection,
        ),
    {
        loading: () => (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
        ),
    },
);

export function DashboardContent() {
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
