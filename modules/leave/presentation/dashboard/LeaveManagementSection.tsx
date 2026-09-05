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

interface LeaveManagementSectionProps {
    defaultTab?: string;
}

export function LeaveManagementSection({ defaultTab = "my-leave" }: LeaveManagementSectionProps) {
    const { user } = useDashboardDataContext();
    const canApproveLeave = user?.canApproveLeave === true;
    const canViewLeaveReports = user?.canViewLeaveReports === true;
    const isAdmin = isAdminRole(user?.role);
    const canRecoverLeave = isAdmin;

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

    const tabs = getLeaveTabs(canApproveLeave, canViewLeaveReports, canRecoverLeave);
    const hasTabs = canApproveLeave || canViewLeaveReports || canRecoverLeave;
    const activeTabIsVisible = tabs.some((tab) => tab.value === activeTab && tab.visible !== false);
    const safeActiveTab = activeTabIsVisible
        ? activeTab
        : canRecoverLeave
            ? "recovery"
            : "my-leave";

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
    canApproveLeave: boolean,
    canViewLeaveReports: boolean,
    canRecoverLeave: boolean,
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
            content: <ManagerApprovalDashboard />,
            visible: canApproveLeave,
        },
        {
            value: "recovery",
            label: "กู้คืนรายการลา",
            content: <AdminLeaveRecoveryDashboard />,
            visible: canRecoverLeave,
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
            visible: canRecoverLeave,
        },
    ];
}
