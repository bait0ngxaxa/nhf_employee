import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function DashboardSidebarSkeleton(): ReactElement {
    return (
        <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex 2xl:w-72">
            <div className="flex items-center gap-4 p-6">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="ml-auto h-8 w-8 rounded-lg" />
            </div>

            <div className="flex-1 space-y-4 overflow-hidden px-4 pb-3">
                <Skeleton className="h-11 w-full rounded-xl" />
                {Array.from({ length: 3 }).map((_, groupIndex) => (
                    <div key={groupIndex} className="space-y-2">
                        <Skeleton className="h-7 w-24" />
                        {Array.from({ length: 2 }).map((__, itemIndex) => (
                            <Skeleton
                                key={itemIndex}
                                className="h-11 w-full rounded-xl"
                            />
                        ))}
                    </div>
                ))}
            </div>

            <div className="border-t border-sidebar-border p-4">
                <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-28 max-w-full" />
                        <Skeleton className="h-3 w-20 max-w-full" />
                    </div>
                </div>
            </div>
        </aside>
    );
}

function DashboardNavbarSkeleton(): ReactElement {
    return (
        <header className="sticky top-0 z-30 shrink-0 border-b border-border-faint bg-surface/95 pt-[env(safe-area-inset-top)]">
            <div className="flex min-h-12 min-w-0 items-center justify-between px-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] sm:px-[calc(1.5rem+env(safe-area-inset-left))] sm:pr-[calc(1.5rem+env(safe-area-inset-right))] lg:pl-[calc(2.5rem+env(safe-area-inset-left))] lg:pr-[calc(2.5rem+env(safe-area-inset-right))]">
                <Skeleton className="h-10 w-10 rounded-2xl lg:hidden" />
                <div className="ml-auto flex items-center gap-2 sm:gap-4">
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                    <Skeleton className="hidden h-8 w-px rounded-none sm:block" />
                    <Skeleton className="hidden h-12 w-44 rounded-[1.25rem] sm:block" />
                    <Skeleton className="h-10 w-10 rounded-2xl sm:hidden" />
                </div>
            </div>
        </header>
    );
}

export function DashboardShellSkeleton(): ReactElement {
    return (
        <div
            className="app-shell-background flex h-dvh min-h-0"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดแดชบอร์ด"
        >
            <DashboardSidebarSkeleton />

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <DashboardNavbarSkeleton />
                <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-hidden py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] lg:p-6 lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))] 2xl:p-8 2xl:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <Skeleton className="h-full min-h-[calc(100dvh-7rem)] w-full rounded-2xl opacity-60" />
                </main>
            </div>
        </div>
    );
}
