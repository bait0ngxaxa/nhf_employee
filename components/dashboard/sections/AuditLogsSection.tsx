"use client";

import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { History } from "lucide-react";
import { AuditLogsProvider } from "@/components/dashboard/context/audit-logs/AuditLogsProvider";

export function AuditLogsSection() {
    return (
        <AuditLogsProvider>
            <div className="audit-logs-background relative min-h-[calc(100dvh-6rem)] overflow-hidden rounded-3xl border border-content-on-brand/60 bg-surface-subtle/50 shadow-inner">
                <div className="relative z-10 min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    {/* Header */}
                    <div className="flex min-w-0 flex-col justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out md:flex-row md:items-end">
                        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                            <div className="relative group cursor-default">
                                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-yellow-500/40 to-amber-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/25 ring-1 ring-content-on-brand/20">
                                    <History className="h-7 w-7 text-content-on-brand" />
                                </div>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h1
                                    data-page-heading
                                    tabIndex={-1}
                                    className="text-2xl font-bold leading-tight tracking-tight text-content-heading [overflow-wrap:anywhere] sm:text-3xl"
                                >
                                    บันทึกการใช้งาน
                                </h1>
                                <p className="font-medium text-content-neutral-muted">
                                    ประวัติการดำเนินการในระบบ
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                        <div className="rounded-2xl bg-surface/95 p-1 shadow-lg ring-1 ring-surface-neutral-border">
                            <AuditLogViewer />
                        </div>
                    </div>
                </div>
            </div>
        </AuditLogsProvider>
    );
}
