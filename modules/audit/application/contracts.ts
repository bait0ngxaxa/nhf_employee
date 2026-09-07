import type { AuditAction, Prisma } from "@prisma/client";

/** Generic JSON details persisted with an audit record. */
export interface AuditDetails extends Record<string, unknown> {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/** Fully resolved values needed to append one generic audit record. */
export interface AuditAppendCommand {
    action: AuditAction;
    entityType: string;
    entityId?: number | null;
    userId?: number | null;
    userEmail?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    details?: AuditDetails | null;
}

/** The transaction-bound persistence capability needed by a strict append. */
export type AuditLogPersistenceContext = Pick<
    Prisma.TransactionClient,
    "auditLog"
>;

/** Filters for the generic administrative audit-log query. */
export interface AuditLogFilters {
    action?: string;
    entityType?: string;
    search?: string;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
}

export interface AuditLogUserInfo {
    id: number;
    name: string;
    email: string;
    employee: {
        firstName: string;
        lastName: string;
        nickname: string | null;
    } | null;
}

/** Audit row shape returned after tolerant details parsing. */
export interface AuditLogWithUser {
    id: number;
    action: AuditAction;
    entityType: string;
    entityId: number | null;
    userId: number | null;
    userEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    details: Record<string, unknown> | null;
    createdAt: Date;
    user: AuditLogUserInfo | null;
}

export interface PaginatedAuditLogsResult {
    auditLogs: AuditLogWithUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface CleanupAuditLogsResult {
    deletedCount: number;
    cutoff: Date;
}
