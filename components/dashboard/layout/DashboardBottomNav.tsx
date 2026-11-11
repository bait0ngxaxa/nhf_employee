"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { projectDashboardMobileTabs, resolveDashboardMobileTab } from "@/lib/ui/dashboard-mobile-navigation";
import { mobileNavigationItemClassName } from "@/lib/ui/mobile-navigation-styles";
import { DashboardNavigationLink } from "./DashboardNavigationLink";

export function DashboardBottomNav(): ReactElement {
    const { availableMenuGroups } = useDashboardDataContext();
    const tabs = projectDashboardMobileTabs(availableMenuGroups);
    const activeId = resolveDashboardMobileTab(usePathname(), tabs);
    return (
        <nav aria-label="เมนูหลักบนมือถือ" className="dashboard-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface-raised lg:hidden">
            <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <li key={tab.id} className="min-w-0">
                            <DashboardNavigationLink href={tab.href} aria-current={activeId === tab.id ? "page" : undefined} className={`${mobileNavigationItemClassName(activeId === tab.id)} h-full`}>
                                <Icon className="size-5" aria-hidden="true" />
                                <span className="max-w-full truncate">{tab.label}</span>
                            </DashboardNavigationLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
