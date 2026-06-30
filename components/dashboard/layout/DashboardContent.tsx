"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

import { useTitle } from "@/hooks/useTitle";
import { SectionSkeleton } from "@/components/dashboard/feedback/SectionSkeleton";
import { EmailRequestSectionSkeleton } from "@/components/dashboard/feedback/EmailRequestSectionSkeleton";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

// Dynamically import Dashboard Sections for code splitting
const StockSection = dynamic(
    () =>
        import("@/components/dashboard/sections/StockSection").then(
            (mod) => mod.StockSection,
        ),
    { loading: () => <SectionSkeleton />, ssr: false },
);
const ITSupportSection = dynamic(
    () =>
        import("@/components/dashboard/sections/ITSupportSection").then(
            (mod) => mod.ITSupportSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const EmailRequestSection = dynamic(
    () =>
        import("@/components/dashboard/sections/EmailRequestSection").then(
            (mod) => mod.EmailRequestSection,
        ),
    { loading: () => <EmailRequestSectionSkeleton /> },
);
const EmployeeManagementSection = dynamic(
    () =>
        import("@/components/dashboard/sections/EmployeeManagementSection").then(
            (mod) => mod.EmployeeManagementSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const AddEmployeeSection = dynamic(
    () =>
        import("@/components/dashboard/sections/AddEmployeeSection").then(
            (mod) => mod.AddEmployeeSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const AuditLogsSection = dynamic(
    () =>
        import("@/components/dashboard/sections/AuditLogsSection").then(
            (mod) => mod.AuditLogsSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const DashboardHomeSection = dynamic(
    () =>
        import("@/components/dashboard/sections/DashboardHomeSection").then(
            (mod) => mod.DashboardHomeSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const LeaveManagementSection = dynamic(
    () =>
        import("@/components/dashboard/sections/LeaveManagementSection").then(
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
        import("@/components/dashboard/notifications/NotificationsPageContent").then(
            (mod) => mod.NotificationsSection,
        ),
    { loading: () => <SectionSkeleton /> },
);
const SessionManagementSection = dynamic(
    () =>
        import("@/components/dashboard/sections/SessionManagementSection").then(
            (mod) => mod.SessionManagementSection,
        ),
    { loading: () => <SectionSkeleton /> },
);

function getPageTitle(menu: string): string {
    switch (menu) {
        case "dashboard": return "Dashboard | NHFapp";
        case "leave-management": return "Leave Management | NHFapp";
        case "stock": return "Stock | NHFapp";
        case "it-support": return "IT Support | NHFapp";
        case "email-request": return "New Employee Request | NHFapp";
        case "employee-management": return "Employee Management | NHFapp";
        case "add-employee": return "Add Employee | NHFapp";
        case "import-employee": return "Import Employee CSV | NHFapp";
        case "audit-logs": return "Audit Logs | NHFapp";
        case "notifications": return "Notifications | NHFapp";
        case "sessions": return "Session Management | NHFapp";
        default: return "NHFapp";
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

            case "stock":
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
                    <Suspense fallback={<EmailRequestSectionSkeleton />}>
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
