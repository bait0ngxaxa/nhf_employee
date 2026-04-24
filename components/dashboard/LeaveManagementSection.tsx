"use client";

import { CalendarRange, CalendarDays, CheckSquare, Settings2, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { useDashboardDataContext } from "./context/dashboard/DashboardContext";
import { EmployeeLeaveDashboard } from "./leave/EmployeeLeaveDashboard";
import { ManagerApprovalDashboard } from "./leave/ManagerApprovalDashboard";
import { ApproverManagement } from "./leave/ApproverManagement";
import { LeaveReportsDashboard } from "./leave/LeaveReportsDashboard";
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
    const isAdmin = isAdminRole(user?.role);
    const showApprovalTab = isManager;

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

    const tabs: SectionTabItem[] = [
        {
            value: "my-leave",
            label: "วันลาของฉัน",
            icon: CalendarDays,
            content: <EmployeeLeaveDashboard />,
        },
        {
            value: "approvals",
            label: "อนุมัติการลา",
            icon: CheckSquare,
            content: <ManagerApprovalDashboard />,
            visible: showApprovalTab,
        },
        {
            value: "reports",
            label: "รีพอร์ต",
            icon: BarChart3,
            content: <LeaveReportsDashboard />,
            visible: showApprovalTab,
        },
        {
            value: "approver-settings",
            label: "จัดการผู้อนุมัติ",
            icon: Settings2,
            content: <ApproverManagement />,
            visible: isAdmin,
        },
    ];

    const hasTabs = showApprovalTab || isAdmin;

    return (
        <SectionShell
            gradientFrom="rgba(199,210,254,0.3)"
            gradientTo="rgba(14,165,233,0.15)"
        >
            <SectionHeader
                icon={CalendarRange}
                title="NHF Leave"
                subtitle="จัดการวันลาพักผ่อน ลากิจ ลาป่วย และตรวจสอบโควต้าของคุณ"
                iconGradient="from-indigo-500 to-blue-600"
                iconGlow="from-indigo-500/40 to-blue-500/40"
                iconShadow="shadow-indigo-500/25"
                badgeColor="bg-indigo-50 text-indigo-700 border-indigo-100"
            />

            {isMounted && hasTabs ? (
                <SectionTabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    tabs={tabs}
                    activeColor="#4f46e5"
                />
            ) : (
                <EmployeeLeaveDashboard />
            )}
        </SectionShell>
    );
}
