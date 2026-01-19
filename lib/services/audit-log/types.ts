import type { AuditLog } from "@prisma/client";

// ==================== Input Types ====================

/** Filters for querying audit logs */
export interface AuditLogFilters {
    action?: string;
    entityType?: string;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
}

/** User context for authorization checks */
export interface UserContext {
    id: number;
    role: string;
    email: string;
}

// ==================== Relation Types ====================

/** User info for audit log */
export interface AuditLogUserInfo {
    id: number;
    name: string;
    email: string;
}

/** Audit log with user and parsed details */
export interface AuditLogWithUser extends Omit<AuditLog, "details"> {
    user: AuditLogUserInfo | null;
    details: Record<string, unknown> | null;
}

// ==================== Output Types ====================

/** Paginated audit logs response */
export interface PaginatedAuditLogsResult {
    auditLogs: AuditLogWithUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
