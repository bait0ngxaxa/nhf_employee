import type { ReactElement } from "react";

import {
    PaginationSkeleton,
    SectionHeaderSkeleton,
    TabsSkeleton,
} from "@/components/dashboard/feedback/SectionSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

function RoutineTaskMobileSkeleton(): ReactElement {
    return (
        <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-border-subtle py-3"
                >
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-full" />
                </div>
            ))}
            <div className="grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="col-span-2 h-9 w-full" />
            </div>
        </div>
    );
}

function RoutineTaskListSkeletonContent(): ReactElement {
    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-brand-border/70 bg-surface-raised lg:hidden">
                <div className="divide-y divide-border-subtle">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <RoutineTaskMobileSkeleton key={index} />
                    ))}
                </div>
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-brand-border/70 bg-surface-raised lg:block">
                <div className="flex min-w-[780px] gap-4 border-b border-brand-border/70 bg-brand-surface px-4 py-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-4 flex-1" />
                    ))}
                </div>
                <div className="min-w-[780px] divide-y divide-border-subtle">
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                        <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
                            {Array.from({ length: 6 }).map((__, columnIndex) => (
                                <Skeleton
                                    key={columnIndex}
                                    className="h-12 flex-1"
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <PaginationSkeleton />
        </div>
    );
}

function RoutineOccurrenceCardSkeleton(): ReactElement {
    return (
        <div className="rounded-xl border border-brand-border/70 bg-surface-raised p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-6 w-2/3" />
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                    </div>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                    <Skeleton className="h-7 w-28 rounded-full" />
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-36" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function RoutineOccurrenceListSkeletonContent(): ReactElement {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
                <RoutineOccurrenceCardSkeleton key={index} />
            ))}
            <PaginationSkeleton />
        </div>
    );
}

export function RoutineTaskListSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดแม่แบบงานประจำ"
        >
            <RoutineTaskListSkeletonContent />
        </div>
    );
}

export function RoutineOccurrenceListSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดรายการ Routine"
        >
            <RoutineOccurrenceListSkeletonContent />
        </div>
    );
}

export function RoutineImportRowsSkeleton(): ReactElement {
    return (
        <div
            className="overflow-hidden rounded-xl border border-brand-border/70 bg-surface-raised"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดแถวข้อมูลนำเข้า"
        >
            <div className="overflow-x-auto">
                <div className="min-w-[1100px]">
                    <div className="flex gap-4 border-b border-brand-border/70 bg-brand-surface px-4 py-3">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton key={index} className="h-4 flex-1" />
                        ))}
                    </div>
                    <div className="divide-y divide-border-subtle">
                        {Array.from({ length: 6 }).map((_, rowIndex) => (
                            <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
                                {Array.from({ length: 8 }).map((__, columnIndex) => (
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

export function RoutineSectionSkeleton(): ReactElement {
    return (
        <div
            className="routine-section relative min-h-[calc(100dvh-6rem)] min-w-0 rounded-xl border border-brand-border/70 bg-surface shadow-sm sm:rounded-2xl"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้า NHF Routine"
        >
            <div className="space-y-8 p-4 sm:space-y-10 sm:p-6 lg:p-10">
                <SectionHeaderSkeleton />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="space-y-4 rounded-xl border border-brand-border bg-brand-surface px-5 py-5"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <Skeleton className="h-5 w-36" />
                            </div>
                            <Skeleton className="h-9 w-20" />
                        </div>
                    ))}
                </div>
                <div className="space-y-6">
                    <TabsSkeleton count={5} />
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-56" />
                            <Skeleton className="h-4 w-96 max-w-full" />
                        </div>
                        <div className="grid gap-4 rounded-xl border border-brand-border/70 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-11 w-full md:w-24" />
                        </div>
                        <RoutineOccurrenceListSkeletonContent />
                    </div>
                </div>
            </div>
        </div>
    );
}
