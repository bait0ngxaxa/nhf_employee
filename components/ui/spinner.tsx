"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    label?: string;
}

const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
};

export function Spinner({ size = "md", className, label }: SpinnerProps) {
    return (
        <div
            className={cn("flex items-center justify-center gap-2", className)}
        >
            <Loader2
                className={cn("animate-spin text-blue-600", sizeClasses[size])}
            />
            {label && <span className="text-gray-600">{label}</span>}
        </div>
    );
}

// Full page loading component for reuse
export function PageLoading({
    message = "กำลังโหลด...",
}: {
    message?: string;
}) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl" />
            </div>

            {/* Loading Content */}
            <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-200/50">
                <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl">
                        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-gray-900">
                            กำลังโหลด
                        </h2>
                        <p className="text-gray-500 mt-1">{message}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
