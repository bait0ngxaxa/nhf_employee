"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type StockLoadingStateProps = {
    message: string;
};

export function StockLoadingState({ message }: StockLoadingStateProps) {
    return (
        <div className="rounded-2xl border border-border-subtle/80 bg-surface-raised py-20 text-center text-content-muted shadow-sm">
            <Loader2
                className="mx-auto mb-4 h-8 w-8 animate-spin text-orange-600"
                aria-hidden="true"
            />
            <p className="animate-pulse">{message}</p>
        </div>
    );
}

type StockEmptyStateProps = {
    icon: ReactNode;
    message: string;
};

export function StockEmptyState({ icon, message }: StockEmptyStateProps) {
    return (
        <div className="rounded-2xl border border-border-subtle/80 bg-surface-raised px-5 py-14 text-center text-content-muted shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-subtle text-content-subtle ring-1 ring-border-subtle">
                {icon}
            </div>
            <p className="text-sm font-medium">{message}</p>
        </div>
    );
}
