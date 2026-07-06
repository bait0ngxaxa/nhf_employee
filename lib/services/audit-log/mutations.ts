import { prisma } from "@/lib/db/prisma";

export const AUDIT_LOG_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CleanupAuditLogsResult {
    deletedCount: number;
    cutoff: Date;
}

export function calculateAuditLogRetentionCutoff(now: Date): Date {
    return new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * MS_PER_DAY);
}

export async function cleanupExpiredAuditLogs(
    now = new Date(),
): Promise<CleanupAuditLogsResult> {
    const cutoff = calculateAuditLogRetentionCutoff(now);
    const { count } = await prisma.auditLog.deleteMany({
        where: {
            createdAt: {
                lt: cutoff,
            },
        },
    });

    return {
        deletedCount: count,
        cutoff,
    };
}
