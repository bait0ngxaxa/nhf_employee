import { AlertCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { getConfigurationIssueLabel } from "../display";
import type { AuthorizationAdministrationConfigurationIssueData } from "../types";

export function ConfigurationIssues({
    issues,
    title = "Configuration issues",
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
                <p className="leading-6">รายการต่อไปนี้ถูกอ่านจาก persisted configuration ตามจริง ห้ามซ่อนหรือแก้ไขอัตโนมัติ</p>
                <ul className="mt-3 space-y-2 text-sm">
                    {issues.map((issue, index) => (
                        <li key={`${issue.source}-${issue.code}-${issue.capabilityKey ?? ""}-${index}`} className="flex gap-2 leading-5">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>
                                <span className="font-semibold">{getConfigurationIssueLabel(issue.code)}</span>
                                <span className="ml-1">({issue.code}) · source: {issue.source}</span>
                                {issue.capabilityKey ? <span className="ml-1 font-mono text-xs">· {issue.capabilityKey}</span> : null}
                                {issue.scope ? <span className="ml-1">· scope {issue.scope}</span> : null}
                                {issue.teamId ? <span className="ml-1">· Team {issue.teamId}</span> : null}
                                {issue.teamRoleId ? <span className="ml-1">· TeamRole {issue.teamRoleId}</span> : null}
                                {issue.userId ? <span className="ml-1">· User {issue.userId}</span> : null}
                            </span>
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
}
