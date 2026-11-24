import { useEffect, useState } from "react";
import LeaveDashboardPage from "@/app/dashboard/leave/page";
import { StockRouteContent } from "@/app/dashboard/stock/StockRouteContent";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { AnnouncementManager } from "@/modules/announcements/client";
import { AuditLogsSection } from "@/modules/audit/client";
import { AuthorizationAdministrationWorkspace } from "@/modules/authorization/client";
import { AddEmployeeSection, EmployeeManagementSection, ImportEmployeeRouteContent } from "@/modules/employee/client";
import { EmailRequestSection, ITWorkspace, LiffITApp } from "@/modules/it/client";
import { LeaveManagementSection, LeaveManagementSectionSkeleton, LiffLeaveApp } from "@/modules/leave/client";
import { LiffRoutineApp, RoutineSection } from "@/modules/routine/client";
import { LiffStockApp } from "@/modules/stock/client";

export function workspaceCapabilities(variant) {
    return {
        employeeId: 20,
        employeeCapabilities: {
            canReadEmployees: true,
            canCreateEmployees: variant !== "restricted",
            canImportEmployees: variant !== "restricted",
        },
        leaveCapabilities: { canReadOwnRequests: true, canCreateOwnRequests: true },
        stockCapabilities: { canReadCatalog: true, canReadOwnRequests: true },
        routineCapabilities: { canReadTasks: true, canExportTasks: variant !== "restricted" },
    };
}

function UnavailableLeave() {
    const [content, setContent] = useState(null);
    useEffect(() => {
        void LeaveDashboardPage({ searchParams: Promise.resolve({}) }).then(setContent);
    }, []);
    return content;
}

export function DashboardWorkspace({ pathname, variant }) {
    switch (pathname) {
        case APP_ROUTES.dashboardLeave:
            if (variant === "unavailable") return <UnavailableLeave />;
            if (variant === "loading") return <LeaveManagementSectionSkeleton />;
            return <LeaveManagementSection />;
        case APP_ROUTES.dashboardStock:
            return <StockRouteContent />;
        case APP_ROUTES.dashboardRoutine:
            return <RoutineSection />;
        case APP_ROUTES.dashboardIT:
            return <ITWorkspace capabilities={{
                canReadOwnTickets: true, canCreateOwnTickets: true,
                canReadAllTickets: true, canReadAnalytics: true,
            }} />;
        case APP_ROUTES.dashboardEmployees:
            return <EmployeeManagementSection />;
        case APP_ROUTES.dashboardEmployeeNew:
            return <AddEmployeeSection />;
        case APP_ROUTES.dashboardEmployeeImport:
            return <ImportEmployeeRouteContent />;
        case APP_ROUTES.dashboardEmailRequest:
            return <EmailRequestSection capabilities={{ canCreateRequests: true, canReadRequests: false }} />;
        case APP_ROUTES.dashboardAnnouncements:
            return <AnnouncementManager initialState={{
                content: "กรุณาตรวจสอบประกาศประจำสัปดาห์ก่อนเริ่มงาน",
                published: false,
                version: 1,
                updatedAt: "2026-11-24T02:00:00.000Z",
            }} />;
        case APP_ROUTES.dashboardAuthorizationAdministration:
            return <AuthorizationAdministrationWorkspace />;
        case APP_ROUTES.dashboardAudit:
            return <AuditLogsSection />;
        default:
            return null;
    }
}

export function LiffWorkspace({ pathname }) {
    switch (pathname) {
        case APP_ROUTES.line.stock:
            return <LiffStockApp />;
        case APP_ROUTES.line.leave:
            return <LiffLeaveApp />;
        case APP_ROUTES.line.routine:
            return <LiffRoutineApp />;
        case APP_ROUTES.line.it:
            return <LiffITApp />;
        default:
            return pathname.startsWith(`${APP_ROUTES.line.it}/`)
                ? <LiffITApp ticketId={pathname.split("/").at(-1)} />
                : null;
    }
}
