import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function SessionRowSkeleton(): ReactElement {
    return (
        <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-start">
            <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-20" />
                <div className="grid gap-x-6 gap-y-2 lg:grid-cols-2 2xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="space-y-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-4 w-32 max-w-full" />
                        </div>
                    ))}
                </div>
            </div>
            <Skeleton className="h-11 w-full" />
        </div>
    );
}

export function SessionManagementSkeleton(): ReactElement {
    return (
        <section
            className="min-h-[calc(100dvh-6rem)] bg-surface-subtle px-4 py-6 md:px-8 md:py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดข้อมูลเซสชัน"
        >
            <div className="mx-auto max-w-6xl space-y-5">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                        <Skeleton className="h-8 w-44 max-w-full" />
                        <Skeleton className="h-4 w-80 max-w-full" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Skeleton className="h-11 w-full sm:w-40" />
                        <Skeleton className="h-11 w-full sm:w-40" />
                    </div>
                </header>

                <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                    <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-56 max-w-full" />
                            <Skeleton className="h-4 w-80 max-w-full" />
                        </div>
                        <Skeleton className="h-11 w-24" />
                    </div>
                    <div className="divide-y divide-border-muted">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <SessionRowSkeleton key={index} />
                        ))}
                    </div>
                    <div className="border-t border-border-muted px-5 py-3">
                        <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                </div>
            </div>
        </section>
    );
}
