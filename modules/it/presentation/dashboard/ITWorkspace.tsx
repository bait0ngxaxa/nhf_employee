"use client";

import { useCallback, useEffect, type ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SectionHeader } from "@/components/ui/section-header";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import {
    APP_ROUTES,
    IT_DASHBOARD_TAB_QUERY_KEY,
    IT_DASHBOARD_TABS,
    type ITDashboardTab,
} from "@/lib/ssot/routes";

import type { ITPresentationCapabilities } from "../../contracts";
import { ITAnalyticsDashboard } from "./ITAnalyticsDashboard";
import { ITTicketOperatorQueue } from "./ITTicketOperatorQueue";
import { ITTicketSelfService } from "./ITTicketSelfService";
import { getVisibleITDashboardTabs, normalizeITDashboardTab } from "./workspace-projection";

export function ITWorkspace({
    capabilities,
}: {
    readonly capabilities: ITPresentationCapabilities;
}): ReactElement {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const visibleTabs = getVisibleITDashboardTabs(capabilities);
    const activeTab = normalizeITDashboardTab(
        searchParams.get(IT_DASHBOARD_TAB_QUERY_KEY),
        capabilities,
    );

    const toTabUrl = useCallback((tab: ITDashboardTab): string => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(IT_DASHBOARD_TAB_QUERY_KEY, tab);
        const query = params.toString();
        return query ? `${pathname}?${query}` : APP_ROUTES.dashboardIT;
    }, [pathname, searchParams]);

    useEffect(() => {
        if (!activeTab || searchParams.get(IT_DASHBOARD_TAB_QUERY_KEY) === activeTab) return;
        router.replace(toTabUrl(activeTab), { scroll: false });
    }, [activeTab, router, searchParams, toTabUrl]);

    const setActiveTab = (value: string): void => {
        const nextTab = normalizeITDashboardTab(value, capabilities);
        if (!nextTab || nextTab === searchParams.get(IT_DASHBOARD_TAB_QUERY_KEY)) return;
        router.push(toTabUrl(nextTab), { scroll: false });
    };

    const tabs: SectionTabItem[] = [
        {
            value: IT_DASHBOARD_TABS.myTickets,
            label: "Ticket ของฉัน",
            visible: visibleTabs.includes(IT_DASHBOARD_TABS.myTickets),
            content: <ITTicketSelfService capabilities={capabilities} embedded />,
        },
        {
            value: IT_DASHBOARD_TABS.queue,
            label: "คิวงาน IT",
            visible: visibleTabs.includes(IT_DASHBOARD_TABS.queue),
            content: <ITTicketOperatorQueue embedded />,
        },
        {
            value: IT_DASHBOARD_TABS.analytics,
            label: "รายงาน",
            visible: visibleTabs.includes(IT_DASHBOARD_TABS.analytics),
            content: <ITAnalyticsDashboard embedded />,
        },
    ];

    return (
        <SectionShell className="border-border-subtle/70 bg-surface">
            <SectionHeader
                title="บริการ IT"
                subtitle="แจ้งปัญหา ติดตามคำขอ และจัดการงานบริการ IT"
            />
            {activeTab ? (
                <SectionTabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    tabs={tabs}
                    activeColor="var(--module-it-tab)"
                    ariaLabel="ส่วนงานบริการ IT"
                />
            ) : (
                <div role="status" className="border-y border-status-warning-border bg-status-warning-surface px-4 py-5 text-sm leading-6 text-status-warning-strong">
                    บัญชีนี้ยังไม่มีสิทธิ์ใช้งานส่วนบริการ IT ที่เปิดอยู่
                </div>
            )}
        </SectionShell>
    );
}
