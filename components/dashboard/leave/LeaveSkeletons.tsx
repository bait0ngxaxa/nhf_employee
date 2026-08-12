import type { ReactElement } from "react";

import {
    SectionHeaderSkeleton,
    TabsSkeleton,
} from "@/components/dashboard/feedback/SectionSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

function LeaveQuotaSkeleton(): ReactElement {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <div className="mt-4 flex items-end gap-2">
                        <Skeleton className="h-10 w-16" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="pt-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="mt-1 h-4 w-36" />
                    </div>
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-2 h-2 w-full rounded-full" />
        </div>
    );
}

function LeaveHistoryItemSkeleton(): ReactElement {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-6 w-28" />
                    </div>
                    <Skeleton className="h-5 w-56 max-w-full" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-9 w-28" />
                </div>
            </div>
        </div>
    );
}

function EmployeeLeaveDashboardSkeletonContent(): ReactElement {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-7 w-56 max-w-full" />
                    <Skeleton className="h-5 w-80 max-w-full" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <LeaveQuotaSkeleton key={index} />
                ))}
            </div>

            <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-40" />
                        <Skeleton className="h-5 w-96 max-w-full" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-full" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <LeaveHistoryItemSkeleton key={index} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ApprovalGroupSkeleton({ large = false }: { large?: boolean }): ReactElement {
    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-56 max-w-full" />
                    <Skeleton className="h-5 w-[32rem] max-w-full" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                        <Skeleton className="h-6 w-64 max-w-full" />
                        <Skeleton className="h-5 w-80 max-w-full" />
                        {large ? (
                            <div className="grid gap-4 rounded-xl border border-border-subtle p-4 sm:grid-cols-2">
                                <Skeleton className="h-14 w-full" />
                                <Skeleton className="h-14 w-full" />
                            </div>
                        ) : null}
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                    <div className="flex gap-2 lg:w-40 lg:flex-col">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ManagerApprovalDashboardSkeletonContent({
    isAdmin,
}: {
    isAdmin: boolean;
}): ReactElement {
    return (
        <div className="space-y-6">
            {isAdmin ? (
                <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
                <ApprovalGroupSkeleton large />
            )}
            <ApprovalGroupSkeleton />
            <ApprovalGroupSkeleton />
            {!isAdmin ? <ApprovalGroupSkeleton /> : null}
        </div>
    );
}

export function EmployeeLeaveDashboardSkeleton(): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดข้อมูลวันลา"
        >
            <EmployeeLeaveDashboardSkeletonContent />
        </div>
    );
}

export function ManagerApprovalDashboardSkeleton({
    isAdmin = false,
}: {
    isAdmin?: boolean;
}): ReactElement {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดรายการอนุมัติการลา"
        >
            <ManagerApprovalDashboardSkeletonContent isAdmin={isAdmin} />
        </div>
    );
}

export function LeaveManagementSectionSkeleton({
    showApprovals = false,
}: {
    showApprovals?: boolean;
}): ReactElement {
    return (
        <div
            className="relative min-h-[calc(100dvh-6rem)] min-w-0 rounded-xl border border-border-subtle/70 bg-surface shadow-sm sm:rounded-2xl"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="กำลังโหลดหน้าจัดการวันลา"
        >
            <div className="space-y-8 p-4 sm:space-y-10 sm:p-6 lg:p-10">
                <SectionHeaderSkeleton />
                <div className="space-y-6">
                    <TabsSkeleton count={4} />
                    {showApprovals ? (
                        <ManagerApprovalDashboardSkeletonContent isAdmin={false} />
                    ) : (
                        <EmployeeLeaveDashboardSkeletonContent />
                    )}
                </div>
            </div>
        </div>
    );
}
