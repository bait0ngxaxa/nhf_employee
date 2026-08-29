"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

import { useTitle } from "@/hooks/useTitle";
import {
    DashboardHomeSkeleton,
    FormSectionSkeleton,
    ImportSectionSkeleton,
    NotificationSectionSkeleton,
} from "@/components/dashboard/feedback/SectionSkeleton";
import { EmailRequestSectionSkeleton } from "@/components/dashboard/feedback/EmailRequestSectionSkeleton";
import { StockSectionSkeleton } from "@/components/dashboard/stock/StockSkeletons";
import { EmployeeManagementSectionSkeleton } from "@/components/employee/EmployeeSkeletons";
import { AuditLogsSectionSkeleton } from "@/components/audit/AuditLogSkeletons";
import { LeaveManagementSectionSkeleton } from "@/components/dashboard/leave/LeaveSkeletons";
import { SessionManagementSkeleton } from "@/components/dashboard/session-management/SessionManagementSkeleton";
import { RoutineSectionSkeleton } from "@/components/dashboard/routine/RoutineSkeletons";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { isDashboardTabEnabled } from "@/lib/ssot/features";
import { isAdminRole } from "@/lib/ssot/permissions";

// Dynamically import Dashboard Sections for code splitting
const StockSection = dynamic(
    () =>
        import("@/components/dashboard/sections/StockSection").then(
            (mod) => mod.StockSection,
        ),
    { loading: () => <StockSectionSkeleton />, ssr: false },
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
    { loading: () => <EmployeeManagementSectionSkeleton /> },
);
const AddEmployeeSection = dynamic(
    () =>
        import("@/components/dashboard/sections/AddEmployeeSection").then(
            (mod) => mod.AddEmployeeSection,
        ),
    { loading: () => <FormSectionSkeleton /> },
);
const AuditLogsSection = dynamic(
    () =>
        import("@/components/dashboard/sections/AuditLogsSection").then(
            (mod) => mod.AuditLogsSection,
        ),
    { loading: () => <AuditLogsSectionSkeleton /> },
);
const DashboardHomeSection = dynamic(
    () =>
        import("@/components/dashboard/sections/DashboardHomeSection").then(
            (mod) => mod.DashboardHomeSection,
        ),
    { loading: () => <DashboardHomeSkeleton /> },
);
const LeaveManagementSection = dynamic(
    () =>
        import("@/components/dashboard/sections/LeaveManagementSection").then(
            (mod) => mod.LeaveManagementSection,
        ),
    { loading: () => <LeaveManagementSectionSkeleton /> },
);
const ImportEmployeeCSV = dynamic(
    () =>
        import("@/components/employee/import-csv/ImportEmployeeCSV").then(
            (mod) => mod.ImportEmployeeCSV,
        ),
    { loading: () => <ImportSectionSkeleton /> },
);
const NotificationsSection = dynamic(
    () =>
        import("@/components/dashboard/notifications/NotificationsPageContent").then(
            (mod) => mod.NotificationsSection,
        ),
    { loading: () => <NotificationSectionSkeleton /> },
);
const SessionManagementSection = dynamic(
    () =>
        import("@/components/dashboard/sections/SessionManagementSection").then(
            (mod) => mod.SessionManagementSection,
        ),
    { loading: () => <SessionManagementSkeleton /> },
);
const RoutineSection = dynamic(
    () =>
        import("@/components/dashboard/sections/RoutineSection").then(
            (mod) => mod.RoutineSection,
        ),
    { loading: () => <RoutineSectionSkeleton /> },
);

function getPageTitle(menu: string): string {
    switch (menu) {
        case "dashboard": return "Dashboard | NHFapp";
        case "leave-management": return "Leave Management | NHFapp";
        case "stock": return "Stock | NHFapp";
        case "email-request": return "New Employee Request | NHFapp";
        case "employee-management": return "Employee Management | NHFapp";
        case "add-employee": return "Add Employee | NHFapp";
        case "import-employee": return "Import Employee CSV | NHFapp";
        case "audit-logs": return "Audit Logs | NHFapp";
        case "notifications": return "Notifications | NHFapp";
        case "sessions": return "Session Management | NHFapp";
        case "routine": return "NHF Routine | NHFapp";
        default: return "NHFapp";
    }
}

export function DashboardContent() {
    const { selectedMenu, handleMenuClick } = useDashboardUIContext();
    const { handleEmployeeAdded, user } = useDashboardDataContext();
    const activeMenu = isDashboardTabEnabled(selectedMenu)
        ? selectedMenu
        : "dashboard";
    useTitle(getPageTitle(activeMenu));

    const renderContent = () => {
        switch (activeMenu) {
            case "leave-management":
            case "manager-approval":
            case "leave-history":
            {
                const defaultLeaveTab =
                    activeMenu === "manager-approval" ? "approvals" :
                    activeMenu === "leave-history" ? "my-leave" : undefined;

                return (
                    <Suspense
                        fallback={
                            <LeaveManagementSectionSkeleton
                                showApprovals={
                                    defaultLeaveTab === "approvals"
                                    && user?.canApproveLeave === true
                                }
                                showRecovery={
                                    defaultLeaveTab === "approvals"
                                    && isAdminRole(user?.role)
                                    && user?.canApproveLeave !== true
                                }
                            />
                        }
                    >
                        <LeaveManagementSection defaultTab={defaultLeaveTab} />
                    </Suspense>
                );
            }

            case "stock":
                return (
                    <Suspense fallback={<StockSectionSkeleton />}>
                        <StockSection />
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
                    <Suspense fallback={<EmployeeManagementSectionSkeleton />}>
                        <EmployeeManagementSection />
                    </Suspense>
                );

            case "add-employee":
                return (
                    <Suspense fallback={<FormSectionSkeleton />}>
                        <AddEmployeeSection />
                    </Suspense>
                );

            case "import-employee":
                return (
                    <Suspense fallback={<ImportSectionSkeleton />}>
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
                    <Suspense fallback={<AuditLogsSectionSkeleton />}>
                        <AuditLogsSection />
                    </Suspense>
                );

            case "notifications":
                return (
                    <Suspense fallback={<NotificationSectionSkeleton />}>
                        <NotificationsSection />
                    </Suspense>
                );
            case "sessions":
                return (
                    <Suspense fallback={<SessionManagementSkeleton />}>
                        <SessionManagementSection />
                    </Suspense>
                );

            case "routine":
                return (
                    <Suspense fallback={<RoutineSectionSkeleton />}>
                        <RoutineSection />
                    </Suspense>
                );

            default:
                return (
                    <Suspense fallback={<DashboardHomeSkeleton />}>
                        <DashboardHomeSection />
                    </Suspense>
                );
        }
    };

    return renderContent();
}
