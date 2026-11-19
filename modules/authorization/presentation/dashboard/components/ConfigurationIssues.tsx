import { AlertCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { getConfigurationIssueLabel } from "../display";
import type { AuthorizationAdministrationConfigurationIssueData } from "../types";

export function ConfigurationIssues({
    issues,
    title = "พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ",
}: {
    readonly issues: readonly AuthorizationAdministrationConfigurationIssueData[];
    readonly title?: string;
}): React.ReactElement | null {
    if (issues.length === 0) return null;
    return (
        <Alert variant="destructive" className="border-status-warning-border bg-status-warning-surface text-status-warning-strong">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            <AlertTitle>{title} ({issues.length})</AlertTitle>
            <AlertDescription>
                <p className="leading-6">บางรายการอาจใช้กำหนดการเข้าถึงอย่างปลอดภัยไม่ได้ กรุณาตรวจสอบก่อนปรับสิทธิ์</p>
                <ul className="mt-3 space-y-2 text-sm">
                    {issues.map((issue, index) => (
                        <li key={`${issue.source}-${issue.code}-${index}`} className="flex gap-2 leading-5">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">{getConfigurationIssueLabel(issue.code)}</span>
                        </li>
                    ))}
                </ul>
                <details className="mt-3 border-t border-status-warning-border pt-1">
                    <summary className="min-h-11 cursor-pointer content-center rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        รายละเอียดทางเทคนิค
                    </summary>
                    <ul className="space-y-2 pb-2 text-xs">
                        {issues.map((issue, index) => (
                            <li key={`${issue.source}-${issue.code}-${index}`} className="space-y-1 [overflow-wrap:anywhere]">
                                <p><code>{issue.source}</code> · <code>{issue.code}</code></p>
                                {issue.capabilityKey !== undefined ? <p>รหัสสิทธิ์ <code>{issue.capabilityKey}</code></p> : null}
                                {issue.scope !== undefined ? <p>รหัสขอบเขต <code>{issue.scope}</code></p> : null}
                                {issue.teamId !== undefined ? <p>รหัสทีม <code>{issue.teamId}</code></p> : null}
                                {issue.teamRoleId !== undefined ? <p>รหัสหน้าที่ในทีม <code>{issue.teamRoleId}</code></p> : null}
                                {issue.userId !== undefined ? <p>รหัสผู้ใช้ <code>{issue.userId}</code></p> : null}
                            </li>
                        ))}
                    </ul>
                </details>
            </AlertDescription>
        </Alert>
    );
}
