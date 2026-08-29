"use client";

import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { AuditLogsProvider } from "@/components/dashboard/context/audit-logs/AuditLogsProvider";

export function AuditLogsSection() {
    return (
        <AuditLogsProvider>
            <div className="min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle">
                <div className="min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <header className="min-w-0 space-y-1">
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
                    </header>

                    <AuditLogViewer />
                </div>
            </div>
        </AuditLogsProvider>
    );
}
