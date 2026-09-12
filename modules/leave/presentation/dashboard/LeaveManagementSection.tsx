"use client";

import { useState, useEffect } from "react";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { EmployeeLeaveDashboard } from "./EmployeeLeaveDashboard";
import { ManagerApprovalDashboard } from "./ManagerApprovalDashboard";
import { AdminLeaveRecoveryDashboard } from "./AdminLeaveRecoveryDashboard";
import { ApproverManagement } from "./ApproverManagement";
import { LeaveReportsDashboard } from "./LeaveReportsDashboard";
import { LEAVE_THEME_COLOR } from "./leaveTheme";
import { isAdminRole } from "@/lib/ssot/permissions";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import type { LeavePresentationCapabilities } from "../../application/types";

interface LeaveManagementSectionProps {
    defaultTab?: string;
}

export function LeaveManagementSection({ defaultTab = "my-leave" }: LeaveManagementSectionProps) {
    const { user } = useDashboardDataContext();
    const leaveCapabilities = user?.leaveCapabilities;
    const canReadOwnRequests = leaveCapabilities?.canReadOwnRequests === true;
    const canReadAssignedApprovals = leaveCapabilities?.canReadAssignedApprovals === true;
    const hasApprovalRelationship = user?.canApproveLeave === true;
    const canViewLeaveReports = user?.canViewLeaveReports === true;
    const isAdmin = isAdminRole(user?.role);
    const canRecoverLeave = isAdmin;
    const canManageApprovers = leaveCapabilities?.canManageApprovers === true;

    const [activeTab, setActiveTab] = useState(defaultTab);
    const [isMounted, setIsMounted] = useState(false);

    // Ensure the tab changes if the user clicks a deep link while already on this page
    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const tabs = getLeaveTabs({
        leaveCapabilities,
        canReadOwnRequests,
        canReadAssignedApprovals,
        hasApprovalRelationship,
        canViewLeaveReports,
        canRecoverLeave,
        canManageApprovers,
    });
    const hasTabs = tabs.some((tab) => tab.visible !== false);
    const activeTabIsVisible = tabs.some((tab) => tab.value === activeTab && tab.visible !== false);
    const safeActiveTab = activeTabIsVisible
        ? activeTab
        : tabs.find((tab) => tab.visible !== false)?.value ?? "my-leave";

    return (
        <SectionShell className="border-border-subtle/70 bg-surface">
            <SectionHeader
                title="NHF Leave"
                subtitle="จัดการวันลาพักผ่อน ลากิจ ลาป่วย และตรวจสอบโควต้าของคุณ"
            />
            {isMounted && hasTabs ? (
                <SectionTabs
                    value={safeActiveTab}
                    onValueChange={setActiveTab}
                    tabs={tabs}
                    activeColor={LEAVE_THEME_COLOR}
                    ariaLabel="แท็บระบบลางาน"
                />
            ) : (
                <EmployeeLeaveDashboard leaveCapabilities={leaveCapabilities} />
            )}
        </SectionShell>
    );
}

interface LeaveTabOptions {
    leaveCapabilities?: LeavePresentationCapabilities;
    canReadOwnRequests: boolean;
    canReadAssignedApprovals: boolean;
    hasApprovalRelationship: boolean;
    canViewLeaveReports: boolean;
    canRecoverLeave: boolean;
    canManageApprovers: boolean;
}

function getLeaveTabs({
    leaveCapabilities,
    canReadOwnRequests,
    canReadAssignedApprovals,
    hasApprovalRelationship,
    canViewLeaveReports,
    canRecoverLeave,
    canManageApprovers,
}: LeaveTabOptions): SectionTabItem[] {
    return [
        {
            value: "my-leave",
            label: "วันลาของฉัน",
            group: "work",
            groupLabel: "งานหลัก",
            content: (
                <EmployeeLeaveDashboard
                    leaveCapabilities={leaveCapabilities}
                />
            ),
            visible: canReadOwnRequests,
        },
        {
            value: "approvals",
            label: "อนุมัติการลา",
            group: "work",
            content: (
                <ManagerApprovalDashboard
                    leaveCapabilities={leaveCapabilities}
                    hasApprovalRelationship={hasApprovalRelationship}
                />
            ),
            visible: canReadAssignedApprovals && hasApprovalRelationship,
        },
        {
            value: "recovery",
            label: "กู้คืนรายการลา",
            group: "tools",
            groupLabel: "เครื่องมือ",
            content: <AdminLeaveRecoveryDashboard />,
            visible: canRecoverLeave,
        },
        {
            value: "reports",
            label: "รีพอร์ต",
            group: "tools",
            content: <LeaveReportsDashboard />,
            visible: canViewLeaveReports,
        },
        {
            value: "approver-settings",
            label: "จัดการผู้อนุมัติ",
            group: "tools",
            content: <ApproverManagement />,
            visible: canManageApprovers,
        },
    ];
}
