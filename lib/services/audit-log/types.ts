export type {
    AuditLogFilters,
    AuditLogUserInfo,
    AuditLogWithUser,
    PaginatedAuditLogsResult,
} from "@/modules/audit";

/** User context for authorization checks */
export interface UserContext {
    id: number;
    role: string;
    email: string;
}
