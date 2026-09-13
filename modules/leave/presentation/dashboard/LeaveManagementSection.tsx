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
import {
    getLeaveDashboardTabVisibility,
    type LeaveDashboardTabVisibility,
} from "@/constants/dashboard";
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
    const hasApprovalRelationship = user?.canApproveLeave === true;
    const tabVisibility = getLeaveDashboardTabVisibility({
        isAdmin: isAdminRole(user?.role),
        leaveCapabilities,
        canApproveLeave: user?.canApproveLeave,
        canViewLeaveReports: user?.canViewLeaveReports,
    });

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
        tabVisibility,
        hasApprovalRelationship,
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
    tabVisibility: LeaveDashboardTabVisibility;
    hasApprovalRelationship: boolean;
}

function getLeaveTabs({
    leaveCapabilities,
    tabVisibility,
    hasApprovalRelationship,
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
            visible: tabVisibility["my-leave"],
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
            visible: tabVisibility.approvals,
        },
        {
            value: "recovery",
            label: "กู้คืนรายการลา",
            group: "tools",
            groupLabel: "เครื่องมือ",
            content: <AdminLeaveRecoveryDashboard />,
            visible: tabVisibility.recovery,
        },
        {
            value: "reports",
            label: "รีพอร์ต",
            group: "tools",
            content: <LeaveReportsDashboard />,
            visible: tabVisibility.reports,
        },
        {
            value: "approver-settings",
            label: "จัดการผู้อนุมัติ",
            group: "tools",
            content: <ApproverManagement />,
            visible: tabVisibility["approver-settings"],
        },
    ];
}
