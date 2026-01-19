import { prisma } from "@/lib/prisma";
import type {
    AuditLogFilters,
    PaginatedAuditLogsResult,
    AuditLogWithUser,
} from "./types";

/** User select config */
const AUDIT_LOG_USER_SELECT = {
    id: true,
    name: true,
    email: true,
} as const;

/**
 * Build Prisma where clause from filters
 */
function buildWhereClause(filters: AuditLogFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.userId) where.userId = filters.userId;

    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
            (where.createdAt as Record<string, unknown>).gte =
                filters.startDate;
        }
        if (filters.endDate) {
            (where.createdAt as Record<string, unknown>).lte = filters.endDate;
        }
    }

    return where;
}

/**
 * Parse JSON details from audit log
 */
function parseAuditLogDetails(
    details: string | null,
): Record<string, unknown> | null {
    if (!details) return null;
    try {
        return JSON.parse(details);
    } catch {
        return null;
    }
}

/**
 * Get paginated list of audit logs (Admin only)
 */
export async function getAuditLogs(
    filters: AuditLogFilters,
): Promise<PaginatedAuditLogsResult> {
    const page = Math.max(1, filters.page);
    const limit = Math.min(Math.max(1, filters.limit), 100);
    const skip = (page - 1) * limit;

    const where = buildWhereClause(filters);

    const [auditLogs, totalCount] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: AUDIT_LOG_USER_SELECT,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
        prisma.auditLog.count({ where }),
    ]);

    // Parse details JSON for each log
    const logsWithParsedDetails: AuditLogWithUser[] = auditLogs.map((log) => ({
        ...log,
        details: parseAuditLogDetails(log.details),
    }));

    return {
        auditLogs: logsWithParsedDetails,
        pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
        },
    };
}
