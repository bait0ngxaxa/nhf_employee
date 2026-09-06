import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function NotificationSectionSkeleton(): ReactElement {
    return (
        <section
            className="min-h-[calc(100dvh-6rem)] bg-surface-subtle px-4 py-6 md:px-8 md:py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดการแจ้งเตือน"
        >
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
                <Skeleton className="h-[3.75rem] w-full rounded-xl" />
                <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                    <div className="border-b border-border-subtle px-5 py-3">
                        <Skeleton className="h-5 w-28" />
                    </div>
                    <div className="divide-y divide-border-muted">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="flex items-start gap-4 px-5 py-4">
                                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-4 w-2/5" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
