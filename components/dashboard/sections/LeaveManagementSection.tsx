"use client";

import { useState, useEffect } from "react";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { EmployeeLeaveDashboard } from "@/components/dashboard/leave/EmployeeLeaveDashboard";
import { ManagerApprovalDashboard } from "@/components/dashboard/leave/ManagerApprovalDashboard";
import { ApproverManagement } from "@/components/dashboard/leave/ApproverManagement";
import { LeaveReportsDashboard } from "@/components/dashboard/leave/LeaveReportsDashboard";
import { LEAVE_THEME_COLOR } from "@/components/dashboard/leave/leaveTheme";
import { isAdminRole } from "@/lib/ssot/permissions";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";

interface LeaveManagementSectionProps {
    defaultTab?: string;
}

export function LeaveManagementSection({ defaultTab = "my-leave" }: LeaveManagementSectionProps) {
    const { user } = useDashboardDataContext();
    const isManager = user?.isManager === true;
    const canViewLeaveReports = user?.canViewLeaveReports === true;
    const isAdmin = isAdminRole(user?.role);
    const showApprovalTab = isManager || isAdmin;

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

    const tabs = getLeaveTabs(showApprovalTab, canViewLeaveReports, isAdmin);
    const hasTabs = showApprovalTab || canViewLeaveReports || isAdmin;
    const activeTabIsVisible = tabs.some((tab) => tab.value === activeTab && tab.visible !== false);
    const safeActiveTab = activeTabIsVisible ? activeTab : "my-leave";

    return (
        <SectionShell className="border-border-subtle/70 bg-surface shadow-sm">
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
                <EmployeeLeaveDashboard />
            )}
        </SectionShell>
    );
}

function getLeaveTabs(
    showApprovalTab: boolean,
    canViewLeaveReports: boolean,
    isAdmin: boolean,
): SectionTabItem[] {
    return [
        {
            value: "my-leave",
            label: "วันลาของฉัน",
            content: <EmployeeLeaveDashboard />,
        },
        {
            value: "approvals",
            label: "อนุมัติการลา",
            content: <ManagerApprovalDashboard isAdmin={isAdmin} />,
            visible: showApprovalTab,
        },
        {
            value: "reports",
            label: "รีพอร์ต",
            content: <LeaveReportsDashboard />,
            visible: canViewLeaveReports,
        },
        {
            value: "approver-settings",
            label: "จัดการผู้อนุมัติ",
            content: <ApproverManagement />,
            visible: isAdmin,
        },
    ];
}
