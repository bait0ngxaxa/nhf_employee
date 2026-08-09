import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function AuditLogViewerSkeletonContent(): ReactElement {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-9 w-full sm:w-24" />
            </div>
            <div className="space-y-4 px-6 pb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Skeleton className="h-10 min-w-0 flex-1 sm:min-w-[200px]" />
                    <Skeleton className="h-10 w-full sm:w-44" />
                    <Skeleton className="h-10 w-full sm:w-36" />
                </div>

                <div className="space-y-3 xl:hidden">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={index}
                            className="space-y-4 rounded-xl border border-border-neutral-default p-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-5 w-full" />
                            <div className="grid gap-3 border-t border-border-neutral-muted pt-3 sm:grid-cols-2">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-10 w-full sm:col-span-2" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden overflow-hidden rounded-lg border border-border-subtle xl:block">
                    <div className="flex gap-4 border-b border-border-neutral-default bg-surface-neutral-subtle px-4 py-3">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={index} className="h-4 flex-1" />
                        ))}
                    </div>
                    <div className="divide-y divide-border-neutral-default">
                        {Array.from({ length: 6 }).map((_, rowIndex) => (
                            <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
                                {Array.from({ length: 5 }).map((__, columnIndex) => (
                                    <Skeleton
                                        key={columnIndex}
                                        className="h-10 flex-1"
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AuditLogViewerSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดบันทึกการใช้งาน"
        >
            <AuditLogViewerSkeletonContent />
        </div>
    );
}

export function AuditLogsSectionSkeleton(): ReactElement {
    return (
        <div
            className="relative min-h-[calc(100dvh-6rem)] overflow-hidden rounded-3xl border border-content-on-brand/60 bg-surface-subtle/50 shadow-inner"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้าบันทึกการใช้งาน"
        >
            <div className="relative z-10 min-w-0 space-y-8 p-4 md:p-8">
                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                    <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-8 w-56 max-w-full" />
                        <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                </div>
                <div className="rounded-2xl bg-surface/95 p-1 shadow-lg ring-1 ring-surface-neutral-border">
                    <AuditLogViewerSkeletonContent />
                </div>
            </div>
        </div>
    );
}
