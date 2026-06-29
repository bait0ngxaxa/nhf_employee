"use client";

import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { History } from "lucide-react";
import { AuditLogsProvider } from "@/components/dashboard/context/audit-logs/AuditLogsProvider";

const AUDIT_LOGS_BACKGROUND = [
    "radial-gradient(circle at 100% 0%, rgba(255,228,230,0.6) 0%, transparent 34%)",
    "radial-gradient(circle at 0% 100%, rgba(255,237,213,0.6) 0%, transparent 38%)",
].join(", ");

export function AuditLogsSection() {
    return (
        <AuditLogsProvider>
            <div
                className="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-3xl border border-white/60 bg-slate-50/50 shadow-inner"
                style={{ backgroundImage: AUDIT_LOGS_BACKGROUND }}
            >
                <div className="relative z-10 p-4 md:p-8 space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                        <div className="flex items-center space-x-5">
                            <div className="relative group cursor-default">
                                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-yellow-500/40 to-amber-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                                <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl shadow-lg shadow-yellow-500/25 ring-1 ring-white/20">
                                    <History className="h-7 w-7 text-white" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                                    บันทึกการใช้งาน
                                </h2>
                                <p className="text-gray-500 font-medium">
                                    ประวัติการดำเนินการในระบบ
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                        <div className="bg-white/95 rounded-2xl shadow-lg ring-1 ring-gray-200 p-1">
                            <AuditLogViewer />
                        </div>
                    </div>
                </div>
            </div>
        </AuditLogsProvider>
    );
}
