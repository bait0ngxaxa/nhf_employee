"use client";

import { Loader2 } from "lucide-react";

type StockLoadingStateProps = {
    message: string;
};

export function StockLoadingState({ message }: StockLoadingStateProps) {
    return (
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 py-20 text-center text-gray-500 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
            <Loader2
                className="mx-auto mb-4 h-8 w-8 animate-spin text-orange-600"
                aria-hidden="true"
            />
            <p className="animate-pulse">{message}</p>
        </div>
    );
}
