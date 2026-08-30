import type { ReactElement } from "react";

import { Pagination } from "@/components/Pagination";
import type { LeaveApprovalPaginationMetadata } from "@/hooks/useLeaveApprovals";
import { cn } from "@/lib/ui/utils";

export function ApprovalPagination({
    metadata,
    onPageChange,
}: {
    metadata?: LeaveApprovalPaginationMetadata;
    onPageChange: (page: number) => void;
}): ReactElement | null {
    if (!metadata || metadata.totalPages <= 1) {
        return null;
    }

    return (
        <div className="pt-1">
            <Pagination
                currentPage={metadata.currentPage}
                totalPages={metadata.totalPages}
                itemsPerPage={metadata.itemsPerPage}
                onPageChange={onPageChange}
                onPreviousPage={() => onPageChange(Math.max(1, metadata.currentPage - 1))}
                onNextPage={() => onPageChange(Math.min(metadata.totalPages, metadata.currentPage + 1))}
            />
        </div>
    );
}

export function ApprovalSectionHeader({
    title,
    description,
    count,
    tone,
}: {
    title: string;
    description: string;
    count: number;
    tone: "attention" | "info" | "neutral";
}): ReactElement {
    const toneClassName = {
        attention: "border-module-leave-badge-border bg-module-leave-badge-surface text-module-leave-badge-foreground",
        info: "border-status-info-border-subtle bg-status-info-surface text-status-info-strong",
        neutral: "border-border-subtle bg-surface-subtle text-content-body",
    }[tone];

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h2 className="text-xl/7 font-semibold tracking-tight text-content-heading">{title}</h2>
                <p className="mt-1 max-w-2xl text-sm/6 text-content-secondary">{description}</p>
            </div>
            <span className={cn("w-fit rounded-full border px-3 py-1 text-sm font-medium", toneClassName)}>
                {count} รายการ
            </span>
        </div>
    );
}
