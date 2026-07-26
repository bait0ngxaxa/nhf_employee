import * as z from "zod";

export const LEAVE_REPORT_SCOPES = [
    "approver-history",
    "current-team",
] as const;

export const DEFAULT_LEAVE_REPORT_SCOPE = "approver-history" as const;

export const leaveReportScopeSchema = z
    .enum(LEAVE_REPORT_SCOPES)
    .default(DEFAULT_LEAVE_REPORT_SCOPE);

export type LeaveReportScope = z.infer<typeof leaveReportScopeSchema>;
