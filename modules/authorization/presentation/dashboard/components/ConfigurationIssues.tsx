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
                <p className="leading-6">พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ บางสิทธิ์ของผู้ใช้นี้ไม่สามารถนำมาใช้งานได้อย่างปลอดภัย</p>
                <ul className="mt-3 space-y-2 text-sm">
                    {issues.map((issue, index) => (
                        <li key={`${issue.source}-${issue.code}-${index}`} className="flex gap-2 leading-5">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">{getConfigurationIssueLabel(issue.code)}</span>
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
}
