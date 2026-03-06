"use client";

import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { History } from "lucide-react";
import { AuditLogsProvider } from "./context";

export function AuditLogsSection() {
    return (
        <AuditLogsProvider>
            <div className="space-y-6">
                <div className="flex items-start space-x-4">
                    <div className="p-3 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl shadow-lg shadow-rose-500/20 text-white">
                        <History className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            บันทึกการใช้งาน
                        </h2>
                        <p className="text-gray-600">
                            ประวัติการดำเนินการในระบบ
                        </p>
                    </div>
                </div>
                <AuditLogViewer />
            </div>
        </AuditLogsProvider>
    );
}
