"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

import { useTitle } from "@/hooks/useTitle";
import { SectionSkeleton } from "@/components/dashboard/SectionSkeleton";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

// Dynamically import Dashboard Sections for code splitting
const StockSection = dynamic(
    () =>
        import("@/components/dashboard/StockSection").then(
            (mod) => mod.StockSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const ITSupportSection = dynamic(
    () =>
        import("@/components/dashboard/ITSupportSection").then(
            (mod) => mod.ITSupportSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const EmailRequestSection = dynamic(
    () =>
        import("@/components/dashboard/EmailRequestSection").then(
            (mod) => mod.EmailRequestSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const EmployeeManagementSection = dynamic(
    () =>
        import("@/components/dashboard/EmployeeManagementSection").then(
            (mod) => mod.EmployeeManagementSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const AddEmployeeSection = dynamic(
    () =>
        import("@/components/dashboard/AddEmployeeSection").then(
            (mod) => mod.AddEmployeeSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const AuditLogsSection = dynamic(
    () =>
        import("@/components/dashboard/AuditLogsSection").then(
            (mod) => mod.AuditLogsSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const DashboardHomeSection = dynamic(
    () =>
        import("@/components/dashboard/DashboardHomeSection").then(
            (mod) => mod.DashboardHomeSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const LeaveManagementSection = dynamic(
    () =>
        import("@/components/dashboard/LeaveManagementSection").then(
            (mod) => mod.LeaveManagementSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const ImportEmployeeCSV = dynamic(
    () =>
        import("@/components/employee/import-csv/ImportEmployeeCSV").then(
            (mod) => mod.ImportEmployeeCSV,
        ),
    { loading: () => <SectionSkeleton /> },
);
const NotificationsSection = dynamic(
    () =>
        import("@/components/dashboard/NotificationsPageContent").then(
            (mod) => mod.NotificationsSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const SessionManagementSection = dynamic(
    () =>
        import("@/components/dashboard/SessionManagementSection").then(
            (mod) => mod.SessionManagementSection,
        ),
    { loading: () => <SectionSkeleton /> },
);

function getPageTitle(menu: string): string {
    switch (menu) {
        case "dashboard": return "Dashboard | NHF IT System";
        case "leave-management": return "Leave Management | NHF IT System";
        case "it-equipment": return "IT Equipment | NHF IT System";
        case "it-support": return "IT Support | NHF IT System";
        case "email-request": return "Email Request | NHF IT System";
        case "employee-management": return "Employee Management | NHF IT System";
        case "add-employee": return "Add Employee | NHF IT System";
        case "import-employee": return "Import Employee CSV | NHF IT System";
        case "audit-logs": return "Audit Logs | NHF IT System";
        case "notifications": return "Notifications | NHF IT System";
        case "sessions": return "Session Management | NHF IT System";
        default: return "NHF IT System";
    }
}

export function DashboardContent() {
    const { selectedMenu, handleMenuClick } = useDashboardUIContext();
    const { handleEmployeeAdded } = useDashboardDataContext();
    useTitle(getPageTitle(selectedMenu));

    const renderContent = () => {
        switch (selectedMenu) {
            case "leave-management":
            case "manager-approval":
            case "leave-history":
            {
                const defaultLeaveTab =
                    selectedMenu === "manager-approval" ? "approvals" :
                    selectedMenu === "leave-history" ? "my-leave" : undefined;

                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <LeaveManagementSection defaultTab={defaultLeaveTab} />
                    </Suspense>
                );
            }

            case "it-equipment":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <StockSection />
                    </Suspense>
                );

            case "it-support":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <ITSupportSection />
                    </Suspense>
                );

            case "email-request":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <EmailRequestSection />
                    </Suspense>
                );

            case "employee-management":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <EmployeeManagementSection />
                    </Suspense>
                );

            case "add-employee":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <AddEmployeeSection />
                    </Suspense>
                );

            case "import-employee":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <ImportEmployeeCSV
                            onSuccess={handleEmployeeAdded}
                            onBack={() =>
                                handleMenuClick("employee-management")
                            }
                        />
                    </Suspense>
                );

            case "audit-logs":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <AuditLogsSection />
                    </Suspense>
                );

            case "notifications":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <NotificationsSection />
                    </Suspense>
                );
            case "sessions":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <SessionManagementSection />
                    </Suspense>
                );

            default:
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <DashboardHomeSection />
                    </Suspense>
                );
        }
    };

    return renderContent();
}
