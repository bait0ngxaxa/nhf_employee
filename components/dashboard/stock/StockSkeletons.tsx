import type { ReactElement } from "react";

import {
    PaginationSkeleton,
    SectionHeaderSkeleton,
    TabsSkeleton,
} from "@/components/dashboard/feedback/SectionSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

function StockFiltersSkeleton(): ReactElement {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-subtle/70 p-3 shadow-sm">
            <div className="space-y-2 px-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Skeleton className="h-12 flex-1 rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl sm:w-64" />
            </div>
        </div>
    );
}

function StockProductCardSkeleton(): ReactElement {
    return (
        <div className="flex h-full min-h-[26rem] flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface-raised p-3">
            <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle">
                <div className="flex min-h-10 items-center border-b border-border-subtle px-2 py-1">
                    <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <Skeleton className="h-32 w-full rounded-none" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-24" />
            </div>
            <div className="min-h-8 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="min-h-[5.75rem] space-y-3 rounded-2xl border border-border-subtle bg-surface-subtle/80 p-2.5">
                <Skeleton className="h-4 w-24" />
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="mt-auto h-10 w-full rounded-xl" />
        </div>
    );
}

function StockBrowseSkeletonContent(): ReactElement {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    <StockProductCardSkeleton key={index} />
                ))}
            </div>
            <PaginationSkeleton />
        </div>
    );
}

function StockRequestCardSkeleton(): ReactElement {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <Skeleton className="mt-3 h-10 w-full rounded-xl" />
            <div className="mt-4 flex justify-end">
                <Skeleton className="h-11 w-28" />
            </div>
        </div>
    );
}

function StockRequestTableSkeleton(): ReactElement {
    return (
        <div className="hidden overflow-hidden rounded-2xl bg-surface-raised shadow-sm ring-1 ring-border-subtle xl:block">
            <div className="flex min-w-[1080px] gap-4 border-b border-border-subtle bg-surface-subtle px-4 py-3">
                {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 flex-1" />
                ))}
            </div>
            <div className="min-w-[1080px] divide-y divide-border-subtle">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
                        {Array.from({ length: 7 }).map((__, columnIndex) => (
                            <Skeleton
                                key={columnIndex}
                                className="h-12 flex-1"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function StockRequestListSkeletonContent(): ReactElement {
    return (
        <div className="space-y-4">
            <div className="space-y-3 xl:hidden">
                {Array.from({ length: 3 }).map((_, index) => (
                    <StockRequestCardSkeleton key={index} />
                ))}
            </div>
            <StockRequestTableSkeleton />
            <PaginationSkeleton />
        </div>
    );
}

function StockInventoryCardSkeleton(): ReactElement {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
            <div className="flex gap-3">
                <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-48 max-w-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-32 rounded-full" />
                </div>
            </div>
            <Skeleton className="mt-3 h-4 w-full" />
            <div className="mt-4 grid grid-cols-2 gap-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <Skeleton className="h-11 w-24" />
                <Skeleton className="h-11 w-20" />
            </div>
        </div>
    );
}

function StockInventoryTableSkeleton(): ReactElement {
    return (
        <div className="hidden overflow-hidden rounded-2xl bg-surface-raised shadow-sm ring-1 ring-border-subtle xl:block">
            <div className="flex min-w-[900px] gap-4 border-b border-border-subtle bg-surface-subtle px-4 py-3">
                {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 flex-1" />
                ))}
            </div>
            <div className="min-w-[900px] divide-y divide-border-subtle">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
                        <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
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
    );
}

function StockInventorySkeletonContent(): ReactElement {
    return (
        <div className="space-y-4">
            <div className="space-y-3 xl:hidden">
                {Array.from({ length: 3 }).map((_, index) => (
                    <StockInventoryCardSkeleton key={index} />
                ))}
            </div>
            <StockInventoryTableSkeleton />
            <PaginationSkeleton />
        </div>
    );
}

function ReportPanelSkeleton(): ReactElement {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-28 rounded-full" />
                    <Skeleton className="h-6 w-64 max-w-full" />
                    <Skeleton className="h-4 w-[30rem] max-w-full" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] lg:min-w-[360px]">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="space-y-3 rounded-2xl border border-border-subtle bg-surface-subtle/70 p-4"
                    >
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-6 w-36 max-w-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function StockReportsSkeletonContent(): ReactElement {
    return (
        <div className="space-y-5">
            <ReportPanelSkeleton />
            <ReportPanelSkeleton />
        </div>
    );
}

export function StockBrowseSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดข้อมูลวัสดุ"
        >
            <StockBrowseSkeletonContent />
        </div>
    );
}

export function StockRequestListSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดคำขอเบิกวัสดุ"
        >
            <StockRequestListSkeletonContent />
        </div>
    );
}

export function StockInventorySkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดรายการสต็อก"
        >
            <StockInventorySkeletonContent />
        </div>
    );
}

export function StockReportsSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดรีพอร์ตวัสดุ"
        >
            <StockReportsSkeletonContent />
        </div>
    );
}

export function StockSectionSkeleton(): ReactElement {
    return (
        <div
            className="relative min-h-[calc(100dvh-6rem)] min-w-0 rounded-xl border border-border-subtle/70 bg-surface shadow-sm sm:rounded-2xl"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้าสต็อก"
        >
            <div className="space-y-8 p-4 sm:space-y-10 sm:p-6 lg:p-10">
                <SectionHeaderSkeleton showBadge />
                <div className="space-y-6">
                    <TabsSkeleton count={5} />
                    <StockFiltersSkeleton />
                    <StockBrowseSkeletonContent />
                </div>
            </div>
        </div>
    );
}
