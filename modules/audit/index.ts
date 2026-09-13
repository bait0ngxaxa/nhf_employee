// Audit is a server-only capability. Keep this public entry explicit and small.
export {
    appendAuditBestEffort,
    appendAuditInTransaction,
} from "./application/commands";
export { getAuditEntityHistory, getAuditLogs } from "./application/queries";
export {
    AUDIT_LOG_RETENTION_DAYS,
    calculateAuditLogRetentionCutoff,
    cleanupExpiredAuditLogs,
} from "./application/retention";
export {
    assertAuditCapabilityForMigration,
    assertAuditCapabilityScope,
    buildAuditAuthorizationActor,
    buildAuditAuthorizationContext,
    AuditCapabilityDeniedError,
    AUDIT_MIGRATED_CAPABILITIES,
    getAuditPresentationCapabilities,
    resolveAuditCapabilityForMigration,
} from "./application/authorization";
export type {
    AuditAuthorizationActor,
    AuditAuthorizationContext,
    AuditCapabilityAuthorization,
    AuditMigratedCapability,
} from "./application/authorization";
export type { AuditPresentationCapabilities } from "./application/types";
export type {
    AuditAppendCommand,
    AuditEntityHistoryQuery,
    AuditEntityHistoryRow,
    AuditDetails,
    AuditLogFilters,
    AuditLogPersistenceContext,
    AuditLogUserInfo,
    AuditLogWithUser,
    CleanupAuditLogsResult,
    PaginatedAuditLogsResult,
} from "./application/contracts";
