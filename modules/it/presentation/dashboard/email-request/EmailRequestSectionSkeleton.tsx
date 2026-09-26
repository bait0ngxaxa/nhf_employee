import type { ReactElement } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton(): ReactElement {
    return (
        <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
        </div>
    );
}

function AccessSkeleton(): ReactElement {
    return (
        <div className="space-y-5 border-t border-border-subtle pt-6">
            <Skeleton className="h-5 w-28" />
            <div className="border-b border-border-subtle pb-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                    <Skeleton className="h-7 w-12 rounded-full" />
                </div>
            </div>
            <div className="border-t border-border-subtle pt-5">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="mt-3 h-4 w-64 max-w-full" />
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                        <Skeleton key={index} className="h-11 rounded-md" />
                    ))}
                </div>
            </div>
        </div>
    );
}

function FormSkeleton(): ReactElement {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-6 shadow-none md:p-8">
            <div className="space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-5 w-36" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <FieldSkeleton key={index} />
                        ))}
                        <div className="md:col-span-2">
                            <FieldSkeleton />
                        </div>
                    </div>
                </div>
                <AccessSkeleton />
                <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end">
                    <Skeleton className="h-11 w-full sm:w-28" />
                    <Skeleton className="h-11 w-full sm:w-32" />
                </div>
                <div className="border-t border-border-subtle pt-5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="mt-3 h-12 w-full" />
                </div>
            </div>
        </div>
    );
}

function HistorySkeleton(): ReactElement {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-6 shadow-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <Skeleton className="h-10 w-24" />
            </div>
            <div className="mt-6 overflow-hidden rounded-lg border border-border-subtle">
                <div className="grid grid-cols-6 gap-4 border-b border-border-subtle bg-surface-subtle p-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-4" />
                    ))}
                </div>
                <div className="space-y-4 p-4">
                    {Array.from({ length: 4 }).map((_, rowIndex) => (
                        <div key={rowIndex} className="grid grid-cols-6 gap-4">
                            {Array.from({ length: 6 }).map((_, colIndex) => (
                                <Skeleton key={colIndex} className="h-8" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function EmailRequestSectionSkeleton(): ReactElement {
    return (
        <div
            className="min-h-[calc(100dvh-6rem)]"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้าส่งคำร้องพนักงานใหม่"
        >
            <div className="space-y-8 p-4 md:p-8">
                <div className="flex min-w-0 items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="min-w-0 space-y-2">
                        <Skeleton className="h-8 w-72 max-w-full" />
                        <Skeleton className="h-4 w-96 max-w-full" />
                    </div>
                </div>
                <FormSkeleton />
                <HistorySkeleton />
            </div>
        </div>
    );
}
