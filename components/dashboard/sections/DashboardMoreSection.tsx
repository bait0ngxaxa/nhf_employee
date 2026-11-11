"use client";

import { Bell, Smartphone } from "lucide-react";
import type { ReactElement } from "react";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardAccountMenu } from "@/components/dashboard/layout/DashboardAccountMenu";
import { DashboardNavigationLink } from "@/components/dashboard/layout/DashboardNavigationLink";
import { APP_ROUTES, toDashboardMenuPath } from "@/lib/ssot/routes";

export function DashboardMoreSection(): ReactElement {
    const { user, availableMenuGroups } = useDashboardDataContext();
    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold text-content-heading">เพิ่มเติม</h1>
            <nav aria-label="เมนูเพิ่มเติม" className="space-y-6">
                {availableMenuGroups.map((group) => (
                    <section key={group.id} aria-labelledby={`more-${group.id}`}>
                        <h2 id={`more-${group.id}`} className="mb-2 text-sm font-semibold text-content-secondary">{group.label}</h2>
                        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-raised">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const content = <><Icon className="size-5 shrink-0 text-brand-foreground" aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{item.sidebarLabel ?? item.label}{item.unavailable ? <span className="block text-xs text-content-muted">ยังไม่พร้อมให้บริการ</span> : null}</span></>;
                                const className = "flex min-h-14 items-center gap-3 rounded-lg p-3 text-sm font-medium text-content-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus hover:bg-surface-subtle";
                                return <li key={item.id}>{item.comingSoon ? <span className={className}>{content}<span>เร็วๆ นี้</span></span> : <DashboardNavigationLink href={toDashboardMenuPath(item.id)} className={className}>{content}</DashboardNavigationLink>}</li>;
                            })}
                        </ul>
                    </section>
                ))}
                <section aria-labelledby="more-account">
                    <h2 id="more-account" className="mb-2 text-sm font-semibold text-content-secondary">บัญชีและการใช้งาน</h2>
                    <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-raised p-3">
                        <DashboardNavigationLink href={APP_ROUTES.dashboardSessions} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-content-body hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-focus"><Smartphone className="size-5" aria-hidden="true" />จัดการเซสชัน</DashboardNavigationLink>
                        {user?.notificationCapabilities?.canReadInbox === true ? <DashboardNavigationLink href={APP_ROUTES.dashboardNotifications} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-content-body hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-focus"><Bell className="size-5" aria-hidden="true" />การแจ้งเตือน</DashboardNavigationLink> : null}
                        <p className="px-2 text-sm text-content-secondary">ข้อมูลบัญชี ธีม และออกจากระบบ</p>
                        <DashboardAccountMenu />
                    </div>
                </section>
            </nav>
        </div>
    );
}
