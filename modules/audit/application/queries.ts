import { cache } from "react";
import { AuditAction, type Prisma } from "@prisma/client";

import {
    countAuditLogs,
    findAuditLogs,
    findAuditEntityHistory,
} from "../infrastructure/persistence/audit-log-repository";
import type {
    AuditEntityHistoryQuery,
    AuditEntityHistoryRow,
    AuditLogFilters,
    AuditLogWithUser,
    PaginatedAuditLogsResult,
} from "./contracts";

function buildWhereClause(
    filters: AuditLogFilters,
): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.action) where.action = filters.action as AuditAction;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.userId) where.userId = filters.userId;
    if (filters.search && filters.search.trim().length > 0) {
        const searchTerm = filters.search.trim();
        const normalizedAction = searchTerm.toUpperCase();
        const matchedAction = Object.values(AuditAction).find(
            (action) => action === normalizedAction,
        );

        const searchClauses: Prisma.AuditLogWhereInput[] = [
            {
                entityType: {
                    contains: searchTerm,
                },
            },
            {
                userEmail: {
                    contains: searchTerm,
                },
            },
            {
                user: {
                    is: {
                        name: {
                            contains: searchTerm,
                        },
                    },
                },
            },
            {
                user: {
                    is: {
                        employee: {
                            is: {
                                OR: [
                                    { firstName: { contains: searchTerm } },
                                    { lastName: { contains: searchTerm } },
                                    { nickname: { contains: searchTerm } },
                                ],
                            },
                        },
                    },
                },
            },
        ];
        if (matchedAction) {
            searchClauses.push({
                action: {
                    equals: matchedAction,
                },
            });
        }

        where.OR = searchClauses;
    }

    if (filters.startDate || filters.endDate) {
        const createdAt: Prisma.DateTimeFilter = {};
        if (filters.startDate) createdAt.gte = filters.startDate;
        if (filters.endDate) createdAt.lte = filters.endDate;
        where.createdAt = createdAt;
    }

    return where;
}

function parseAuditLogDetails(
    details: string | null,
): Record<string, unknown> | null {
    if (!details) return null;
    try {
        return JSON.parse(details) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** Get the paginated generic audit-log view with request-level deduplication. */
export const getAuditLogs = cache(
    async (filters: AuditLogFilters): Promise<PaginatedAuditLogsResult> => {
        const page = Math.max(1, filters.page);
        const limit = Math.min(Math.max(1, filters.limit), 100);
        const skip = (page - 1) * limit;

        const where = buildWhereClause(filters);

        const [auditLogs, totalCount] = await Promise.all([
            findAuditLogs(where, skip, limit),
            countAuditLogs(where),
        ]);

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
    },
);

/**
 * Read raw audit history for a feature-owned entity response.
 *
 * This intentionally has no user projection, pagination semantics, or JSON
 * parsing; the producing feature owns how the rows are presented.
 */
export function getAuditEntityHistory(
    query: AuditEntityHistoryQuery,
): Promise<AuditEntityHistoryRow[]> {
    return findAuditEntityHistory(
        query.entityType,
        query.entityId,
        query.limit,
    );
}
