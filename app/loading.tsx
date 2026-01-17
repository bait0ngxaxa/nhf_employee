"use client";

import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-200/30 rounded-full blur-3xl" />
            </div>

            {/* Loading Content */}
            <div className="relative z-10 text-center">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-200/50">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl">
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                กำลังโหลด
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
