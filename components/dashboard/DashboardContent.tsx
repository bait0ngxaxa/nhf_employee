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
const ITEquipmentSection = dynamic(
    () =>
        import("@/components/dashboard/ITEquipmentSection").then(
            (mod) => mod.ITEquipmentSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);
const ITSupportSection = dynamic(
    () =>
        import("@/components/dashboard/ITSupportSection").then(
            (mod) => mod.ITSupportSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);
const EmailRequestSection = dynamic(
    () =>
        import("@/components/dashboard/EmailRequestSection").then(
            (mod) => mod.EmailRequestSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);
const EmployeeManagementSection = dynamic(
    () =>
        import("@/components/dashboard/EmployeeManagementSection").then(
            (mod) => mod.EmployeeManagementSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);
const AddEmployeeSection = dynamic(
    () =>
        import("@/components/dashboard/AddEmployeeSection").then(
            (mod) => mod.AddEmployeeSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);
const AuditLogsSection = dynamic(
    () =>
        import("@/components/dashboard/AuditLogsSection").then(
            (mod) => mod.AuditLogsSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);
const DashboardHomeSection = dynamic(
    () =>
        import("@/components/dashboard/DashboardHomeSection").then(
            (mod) => mod.DashboardHomeSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);

const LeaveManagementSection = dynamic(
    () =>
        import("@/components/dashboard/LeaveManagementSection").then(
            (mod) => mod.LeaveManagementSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);

const ImportEmployeeCSV = dynamic(
    () =>
        import("@/components/employee/import-csv/ImportEmployeeCSV").then(
            (mod) => mod.ImportEmployeeCSV,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);

const NotificationsSection = dynamic(
    () =>
        import("@/components/dashboard/NotificationsPageContent").then(
            (mod) => mod.NotificationsSection,
        ),
    {
        loading: () => <SectionSkeleton />,
    },
);

export function DashboardContent() {
    useTitle("Dashboard | NHF IT System");

    const { selectedMenu, handleMenuClick } = useDashboardUIContext();
    const { handleEmployeeAdded } = useDashboardDataContext();

    const renderContent = () => {
        switch (selectedMenu) {
            case "leave-management":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <LeaveManagementSection />
                    </Suspense>
                );

            case "it-equipment":
                return (
                    <Suspense fallback={<SectionSkeleton />}>
                        <ITEquipmentSection />
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
