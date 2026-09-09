import {
    appendAuditLog,
} from "../infrastructure/persistence/audit-log-repository";
import type {
    AuditAppendCommand,
    AuditLogPersistenceContext,
} from "./contracts";

/**
 * Append an audit row through the caller's transaction-bound context.
 * Persistence failures intentionally propagate to the enclosing transaction.
 */
export async function appendAuditInTransaction(
    persistenceContext: AuditLogPersistenceContext,
    command: AuditAppendCommand,
): Promise<void> {
    await appendAuditLog(command, persistenceContext);
}

/**
 * Append an audit row without making it part of the caller's success path.
 * This preserves the legacy best-effort failure policy for compatibility users.
 */
export async function appendAuditBestEffort(
    command: AuditAppendCommand,
): Promise<void> {
    try {
        await appendAuditLog(command);
    } catch (error) {
        console.error("[AuditLog] Failed to create audit log:", {
            event: "audit_persistence_failed",
            action: command.action,
            entityType: command.entityType,
            entityId: command.entityId,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
