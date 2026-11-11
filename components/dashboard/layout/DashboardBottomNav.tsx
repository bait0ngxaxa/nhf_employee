"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { projectDashboardMobileTabs, resolveDashboardMobileTab } from "@/lib/ui/dashboard-mobile-navigation";
import { cn } from "@/lib/ui/utils";
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
                            <DashboardNavigationLink href={tab.href} aria-current={activeId === tab.id ? "page" : undefined} className={cn(
                                "relative flex h-full min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus active:bg-brand-surface",
                                activeId === tab.id ? "bg-brand-surface text-brand-foreground" : "text-content-muted hover:bg-surface-subtle hover:text-content-body",
                            )}>
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
