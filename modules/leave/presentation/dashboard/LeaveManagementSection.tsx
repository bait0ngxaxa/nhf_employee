"use client";

import { useRouter } from "next/navigation";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { EmployeeLeaveDashboard } from "./EmployeeLeaveDashboard";
import { ManagerApprovalDashboard } from "./ManagerApprovalDashboard";
import { AdminLeaveRecoveryDashboard } from "./AdminLeaveRecoveryDashboard";
import { ApproverManagement } from "./ApproverManagement";
import { LeaveReportsDashboard } from "./LeaveReportsDashboard";
import { LEAVE_THEME_COLOR } from "./leaveTheme";
import {
    getLeaveDashboardTabVisibility,
    type LeaveDashboardTabVisibility,
} from "@/constants/dashboard";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import type { LeavePresentationCapabilities } from "../../application/types";
import { toDashboardLeaveTabPath } from "@/lib/ssot/routes";

interface LeaveManagementSectionProps {
    routeTab?: string;
}

export function LeaveManagementSection({ routeTab = "my-leave" }: LeaveManagementSectionProps) {
    const router = useRouter();
    const { user } = useDashboardDataContext();
    const leaveCapabilities = user?.leaveCapabilities;
    const hasApprovalRelationship = user?.canApproveLeave === true;
    const tabVisibility = getLeaveDashboardTabVisibility({
        leaveCapabilities,
        canApproveLeave: user?.canApproveLeave,
        canViewLeaveReports: user?.canViewLeaveReports,
    });

    const tabs = getLeaveTabs({
        leaveCapabilities,
        tabVisibility,
        hasApprovalRelationship,
    });
    const hasTabs = tabs.some((tab) => tab.visible !== false);
    const activeTabIsVisible = tabs.some((tab) => tab.value === routeTab && tab.visible !== false);
    const safeActiveTab = activeTabIsVisible
        ? routeTab
        : tabs.find((tab) => tab.visible !== false)?.value ?? "my-leave";

    function handleTabChange(value: string): void {
        if (!tabs.some((tab) => tab.value === value && tab.visible !== false)) {
            return;
        }

        if (value === routeTab) {
            return;
        }

        router.push(toDashboardLeaveTabPath(value), { scroll: false });
    }

    return (
        <SectionShell className="border-border-subtle/70 bg-surface">
            <SectionHeader
                title="NHF Leave"
                subtitle="จัดการวันลาพักผ่อน ลากิจ ลาป่วย และตรวจสอบโควต้าของคุณ"
            />
            {hasTabs ? (
                <SectionTabs
                    value={safeActiveTab}
                    onValueChange={handleTabChange}
                    tabs={tabs}
                    activeColor={LEAVE_THEME_COLOR}
                    ariaLabel="แท็บระบบลางาน"
                />
            ) : (
                null
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
