"use client";

import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Sidebar Skeleton */}
            <div className="w-64 bg-white/80 backdrop-blur-xl shadow-lg border-r border-gray-200/50 p-4 hidden md:flex flex-col">
                <div className="h-8 bg-gray-200/50 rounded-lg animate-pulse mb-6"></div>
                <div className="space-y-3 flex-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="h-10 bg-gray-100/50 rounded-xl animate-pulse"
                        ></div>
                    ))}
                </div>
                <div className="h-20 bg-gray-100/50 rounded-xl animate-pulse mt-4"></div>
            </div>

            {/* Main Content Loading */}
            <div className="flex-1 flex items-center justify-center relative">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-3xl"></div>
                </div>

                {/* Loading Card */}
                <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-200/50">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl">
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-gray-900">
                                กำลังโหลดแดชบอร์ด
                            </h2>
                            <p className="text-gray-500 mt-1">
                                กรุณารอสักครู่...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
