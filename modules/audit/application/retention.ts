import { deleteExpiredAuditLogs } from "../infrastructure/persistence/audit-log-repository";
import type { CleanupAuditLogsResult } from "./contracts";

export const AUDIT_LOG_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateAuditLogRetentionCutoff(now: Date): Date {
    return new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * MS_PER_DAY);
}

export async function cleanupExpiredAuditLogs(
    now = new Date(),
): Promise<CleanupAuditLogsResult> {
    const cutoff = calculateAuditLogRetentionCutoff(now);
    const { count } = await deleteExpiredAuditLogs(cutoff);

    return {
        deletedCount: count,
        cutoff,
    };
}
