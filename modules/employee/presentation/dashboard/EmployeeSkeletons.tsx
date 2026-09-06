import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function EmployeePaginationSkeleton(): ReactElement {
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

function EmployeeCardSkeleton(): ReactElement {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-48 max-w-full" />
                        <Skeleton className="h-4 w-64 max-w-full" />
                    </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="grid grid-cols-[1rem_minmax(5rem,7rem)_minmax(0,1fr)] items-center gap-2"
                    >
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="ml-auto h-4 w-32 max-w-full" />
                    </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end border-t border-border-muted pt-3">
                <Skeleton className="h-9 w-24" />
            </div>
        </div>
    );
}

function EmployeeTableSkeleton(): ReactElement {
    return (
        <div className="hidden overflow-hidden rounded-xl border border-border-subtle bg-surface-raised xl:block">
            <div className="flex min-w-[1360px] gap-4 border-b border-border-subtle bg-surface-subtle px-5 py-4">
                {Array.from({ length: 9 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 min-w-24 flex-1" />
                ))}
            </div>
            <div className="min-w-[1360px] divide-y divide-border-muted">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
                        <div className="flex min-w-36 flex-1 items-center gap-3">
                            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                        {Array.from({ length: 8 }).map((__, columnIndex) => (
                            <Skeleton
                                key={columnIndex}
                                className="h-8 min-w-24 flex-1"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function EmployeeListSkeletonContent(): ReactElement {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                    <Skeleton className="h-11 min-w-0 flex-1" />
                    <Skeleton className="h-11 w-full sm:w-52" />
                </div>
                <Skeleton className="h-11 w-full xl:w-44" />
            </div>

            <div className="flex min-h-[4.25rem] flex-col gap-3 rounded-xl border border-border-subtle bg-surface-subtle/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-24" />
            </div>

            <div className="grid gap-3 xl:hidden">
                {Array.from({ length: 3 }).map((_, index) => (
                    <EmployeeCardSkeleton key={index} />
                ))}
            </div>
            <EmployeeTableSkeleton />
            <EmployeePaginationSkeleton />
        </div>
    );
}

export function EmployeeListSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดรายชื่อพนักงาน"
        >
            <EmployeeListSkeletonContent />
        </div>
    );
}

export function EmployeeManagementSectionSkeleton(): ReactElement {
    return (
        <div
            className="min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้าจัดการพนักงาน"
        >
            <div className="min-w-0 space-y-8 p-4 md:p-8">
                <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 space-y-2">
                        <Skeleton className="h-8 w-56 max-w-full" />
                        <Skeleton className="h-4 w-80 max-w-full" />
                    </div>
                    <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                className="h-10 w-full sm:w-32"
                            />
                        ))}
                    </div>
                </div>

                <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                    <div className="flex flex-col gap-1 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-36" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="space-y-4 border-border-muted p-4 sm:p-5">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-20" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border-neutral-default bg-surface-raised">
                    <div className="border-b border-border-neutral-muted bg-surface-neutral-subtle/50 px-6 py-5">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="mt-2 h-4 w-56" />
                    </div>
                    <div className="p-0 sm:p-6">
                        <EmployeeListSkeletonContent />
                    </div>
                </section>
            </div>
        </div>
    );
}
