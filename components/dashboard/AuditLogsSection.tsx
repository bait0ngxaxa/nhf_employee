import { AuditLogViewer } from "@/components/audit/AuditLogViewer";

export function AuditLogsSection() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    บันทึกการใช้งาน
                </h2>
                <p className="text-gray-600">ประวัติการดำเนินการในระบบ</p>
            </div>
            <AuditLogViewer />
        </div>
    );
}
