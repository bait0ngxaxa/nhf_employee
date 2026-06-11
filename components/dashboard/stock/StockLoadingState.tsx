"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type StockLoadingStateProps = {
    message: string;
};

export function StockLoadingState({ message }: StockLoadingStateProps) {
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white py-20 text-center text-slate-500 shadow-sm">
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
        <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-14 text-center text-slate-500 shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200">
                {icon}
            </div>
            <p className="text-sm font-medium">{message}</p>
        </div>
    );
}
