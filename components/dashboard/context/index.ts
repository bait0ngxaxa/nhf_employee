// Dashboard Context
export { DashboardProvider } from "./dashboard";
export {
    useDashboardDataContext,
    useDashboardUIContext,
    useDashboardContext,
} from "./dashboard";
export type {
    DashboardDataContextValue,
    DashboardUIContextValue,
} from "./dashboard";

// IT Support Context
export { ITSupportProvider } from "./it-support";
export {
    useITSupportDataContext,
    useITSupportUIContext,
    useITSupportContext,
} from "./it-support";
export type {
    ITSupportDataContextValue,
    ITSupportUIContextValue,
} from "./it-support";

// Employee Context
export { EmployeeProvider } from "./employee";
export {
    useEmployeeDataContext,
    useEmployeeUIContext,
    useEmployeeContext,
} from "./employee";
export type {
    EmployeeDataContextValue,
    EmployeeUIContextValue,
} from "./employee";

// Audit Logs Context
export { AuditLogsProvider } from "./audit-logs";
export { useAuditLogsContext } from "./audit-logs";
export type { AuditLog, AuditLogsContextValue } from "./audit-logs";

// Email Request Context
export { EmailRequestProvider } from "./email-request";
export { useEmailRequestContext } from "./email-request";
export type { EmailRequest, EmailRequestContextValue } from "./email-request";
