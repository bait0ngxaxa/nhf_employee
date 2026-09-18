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
                <p className="leading-6">ระบบพบรายการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ จึงคงสถานะผิดปกติไว้และไม่เปลี่ยนเป็นการอนุญาตโดยอัตโนมัติ</p>
                <details className="mt-3 rounded-lg border border-status-warning-border/70 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">รายละเอียดทางเทคนิค</summary>
                    <ul className="mt-3 space-y-2 text-sm">
                        {issues.map((issue, index) => (
                            <li key={`${issue.source}-${issue.code}-${issue.capabilityKey ?? ""}-${index}`} className="flex gap-2 leading-5">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>
                                    <span className="font-semibold">{getConfigurationIssueLabel(issue.code)}</span>
                                    <span className="ml-1">· code: {issue.code} · source: {issue.source}</span>
                                    {issue.capabilityKey ? <span className="ml-1 font-mono text-xs">· capability: {issue.capabilityKey}</span> : null}
                                    {issue.scope ? <span className="ml-1 font-mono text-xs">· scope: {issue.scope}</span> : null}
                                    {issue.teamId ? <span className="ml-1 font-mono text-xs">· teamId: {issue.teamId}</span> : null}
                                    {issue.teamRoleId ? <span className="ml-1 font-mono text-xs">· teamRoleId: {issue.teamRoleId}</span> : null}
                                    {issue.userId ? <span className="ml-1 font-mono text-xs">· userId: {issue.userId}</span> : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            </AlertDescription>
        </Alert>
    );
}
