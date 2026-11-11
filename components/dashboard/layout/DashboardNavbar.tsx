"use client";

import type { ReactElement } from "react";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardAccountMenu } from "./DashboardAccountMenu";
import { NotificationDropdown } from "@/modules/notification/client";

export function DashboardNavbar(): ReactElement {
    const { user } = useDashboardDataContext();
    return (
        <header className="sticky top-0 z-30 shrink-0 border-b border-border-subtle bg-surface-raised/95 dark:border-border-faint dark:bg-background/95 pt-[env(safe-area-inset-top)]">
            <div className="flex min-w-0 items-center justify-between py-2 lg:py-3 px-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] sm:px-[calc(1.5rem+env(safe-area-inset-left))] sm:pr-[calc(1.5rem+env(safe-area-inset-right))] lg:pl-[calc(2.5rem+env(safe-area-inset-left))] lg:pr-[calc(2.5rem+env(safe-area-inset-right))]">
                <span className="text-lg font-bold text-brand-foreground lg:hidden">NHFapp</span>
                <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
                    {user?.notificationCapabilities?.canReadInbox === true ? (
                        <>
                            <NotificationDropdown canUpdateInbox={user.notificationCapabilities.canUpdateInbox === true} />
                            <div className="mx-1 hidden h-8 w-px bg-border-muted sm:block" />
                        </>
                    ) : null}
                    <div className="hidden lg:block"><DashboardAccountMenu /></div>
                </div>
            </div>
        </header>
    );
}
