// Re-export types
export type {
    AuditLogFilters,
    UserContext,
    AuditLogWithUser,
    PaginatedAuditLogsResult,
} from "./types";

// Import service functions
import { cleanupExpiredAuditLogs } from "./mutations";
import { getAuditLogs } from "./queries";

/**
 * Audit Log Service Object
 */
export const auditLogService = {
    cleanupExpiredAuditLogs,
    getAuditLogs,
};

// Also export individual functions
export {
    AUDIT_LOG_RETENTION_DAYS,
    calculateAuditLogRetentionCutoff,
    cleanupExpiredAuditLogs,
    type CleanupAuditLogsResult,
} from "./mutations";
export { getAuditLogs };
