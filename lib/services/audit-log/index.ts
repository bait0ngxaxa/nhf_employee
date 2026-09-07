// Re-export types
export type {
    AuditLogFilters,
    UserContext,
    AuditLogWithUser,
    PaginatedAuditLogsResult,
} from "./types";

import {
    cleanupExpiredAuditLogs,
    getAuditLogs,
} from "@/modules/audit";

export type { CleanupAuditLogsResult } from "@/modules/audit";

/**
 * Audit Log Service Object
 */
export const auditLogService = {
    cleanupExpiredAuditLogs,
    getAuditLogs,
};

export {
    AUDIT_LOG_RETENTION_DAYS,
    calculateAuditLogRetentionCutoff,
} from "@/modules/audit";
export { cleanupExpiredAuditLogs, getAuditLogs };
