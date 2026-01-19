// Re-export types
export type {
    AuditLogFilters,
    UserContext,
    AuditLogWithUser,
    PaginatedAuditLogsResult,
} from "./types";

// Import service functions
import { getAuditLogs } from "./queries";

/**
 * Audit Log Service Object
 */
export const auditLogService = {
    getAuditLogs,
};

// Also export individual functions
export { getAuditLogs };
