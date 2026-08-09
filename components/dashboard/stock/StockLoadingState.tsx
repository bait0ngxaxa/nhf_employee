import type { ReactElement, ReactNode } from "react";

type StockEmptyStateProps = {
    icon: ReactNode;
    message: string;
};

export function StockEmptyState({
    icon,
    message,
}: StockEmptyStateProps): ReactElement {
    return (
        <div className="rounded-2xl border border-border-subtle/80 bg-surface-raised px-5 py-14 text-center text-content-muted shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-subtle text-content-subtle ring-1 ring-border-subtle">
                {icon}
            </div>
            <p className="text-sm font-medium">{message}</p>
        </div>
    );
}
