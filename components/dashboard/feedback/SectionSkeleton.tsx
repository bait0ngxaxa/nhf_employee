import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function SectionHeaderSkeleton({
    showBadge = false,
}: {
    showBadge?: boolean;
}): ReactElement {
    return (
        <div className="flex min-w-0 flex-col justify-between gap-4 sm:gap-6 lg:flex-row lg:items-end">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5 lg:gap-6">
                <Skeleton className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl lg:h-16 lg:w-16" />
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-8 w-56 max-w-full sm:h-9" />
                    <Skeleton className="h-4 w-96 max-w-full" />
                </div>
            </div>
            {showBadge ? (
                <Skeleton className="h-8 w-28 rounded-full" />
            ) : null}
        </div>
    );
}

export function TabsSkeleton({ count = 4 }: { count?: number }): ReactElement {
    return (
        <div className="min-w-0 max-w-full overflow-hidden pb-1">
            <div className="flex h-[3.25rem] min-w-max gap-1 rounded-xl border border-border-subtle bg-surface-subtle p-1 md:min-w-0 md:w-full">
                {Array.from({ length: count }).map((_, index) => (
                    <Skeleton
                        key={index}
                        className="h-11 w-32 shrink-0 rounded-lg md:min-w-0 md:flex-1"
                    />
                ))}
            </div>
        </div>
    );
}

export function PaginationSkeleton(): ReactElement {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-4 w-24 sm:hidden" />
                <Skeleton className="h-8 w-8" />
            </div>
            <div className="hidden gap-1 sm:flex">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-8" />
                ))}
            </div>
            <Skeleton className="h-4 w-28 self-center sm:self-auto" />
        </div>
    );
}

export function DashboardHomeSkeleton(): ReactElement {
    return (
        <div
            className="relative min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle/70 bg-surface-subtle p-4 shadow-inner sm:rounded-3xl md:p-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้าหลักแดชบอร์ด"
        >
            <div className="mx-auto max-w-7xl space-y-10">
                <div className="min-h-[220px] rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:rounded-3xl md:p-8">
                    <div className="flex h-full min-h-[156px] flex-col justify-between gap-6 md:flex-row md:items-center">
                        <div className="max-w-2xl space-y-4">
                            <Skeleton className="h-7 w-20 rounded-full" />
                            <Skeleton className="h-11 w-[32rem] max-w-full" />
                            <Skeleton className="h-5 w-64 max-w-full" />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Skeleton className="h-9 w-28 rounded-xl" />
                            <Skeleton className="h-9 w-36 rounded-xl" />
                        </div>
                    </div>
                </div>

                <div>
                    <Skeleton className="mb-6 h-7 w-40" />
                    <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                className="min-h-[196px] rounded-2xl sm:rounded-3xl"
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <Skeleton className="mb-6 h-7 w-32" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                className="min-h-[180px] rounded-3xl"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FormSectionSkeleton(): ReactElement {
    return (
        <div
            className="min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดแบบฟอร์มพนักงาน"
        >
            <div className="space-y-8 p-4 md:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                        <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-8 w-56 max-w-full" />
                            <Skeleton className="h-4 w-72 max-w-full" />
                        </div>
                    </div>
                    <Skeleton className="h-11 w-full sm:w-36" />
                </div>

                <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border-subtle bg-surface-raised p-6">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                        {Array.from({ length: 10 }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-11 w-full" />
                            </div>
                        ))}
                    </div>
                    <Skeleton className="mt-6 h-11 w-full" />
                </div>
            </div>
        </div>
    );
}

export function ImportSectionSkeleton(): ReactElement {
    return (
        <div
            className="space-y-6"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้านำเข้าพนักงาน"
        >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64 max-w-full" />
                        <Skeleton className="h-4 w-80 max-w-full" />
                    </div>
                </div>
                <Skeleton className="h-11 w-full sm:w-36" />
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                        <Skeleton className="hidden h-4 flex-1 sm:block" />
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6">
                <Skeleton className="mx-auto h-16 w-16 rounded-2xl" />
                <Skeleton className="mx-auto mt-5 h-6 w-72 max-w-full" />
                <Skeleton className="mx-auto mt-3 h-4 w-96 max-w-full" />
                <Skeleton className="mx-auto mt-6 h-11 w-40" />
                <Skeleton className="mt-8 h-28 w-full rounded-xl" />
            </div>
        </div>
    );
}

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
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-11 w-11 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-40" />
                            <Skeleton className="h-4 w-32" />
                        </div>
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
