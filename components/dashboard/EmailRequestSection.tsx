"use client";

import { EmailRequestForm, EmailRequestHistory } from "@/components/email";
import { Mail } from "lucide-react";
import { EmailRequestProvider } from "./context";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

function EmailRequestContent() {
    const { handleMenuClick } = useDashboardUIContext();

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(237,212,255,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(250,204,255,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <div className="flex items-center space-x-5">
                        <div className="relative group cursor-default">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-violet-500/40 to-fuchsia-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 will-change-transform" />
                            <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl shadow-lg shadow-violet-500/25 ring-1 ring-white/20">
                                <Mail className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                                ขออีเมลพนักงานใหม่
                            </h2>
                            <p className="text-gray-500 font-medium">
                                ส่งคำขออีเมลสำหรับพนักงานใหม่ให้ทีมไอที
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                <EmailRequestForm
                    onCancel={() => handleMenuClick("dashboard")}
                    onSuccess={() => handleMenuClick("dashboard")}
                />
            </div>

                {/* Email Request History */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg ring-1 ring-gray-200 p-1">
                    <EmailRequestHistory />
                </div>
            </div>
        </div>
    );
}

export function EmailRequestSection() {
    return (
        <EmailRequestProvider>
            <EmailRequestContent />
        </EmailRequestProvider>
    );
}
