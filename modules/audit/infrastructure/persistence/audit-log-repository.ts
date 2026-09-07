import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
    AuditAppendCommand,
    AuditEntityHistoryRow,
    AuditLogPersistenceContext,
} from "../../application/contracts";

const AUDIT_LOG_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    employee: {
        select: {
            firstName: true,
            lastName: true,
            nickname: true,
        },
    },
} as const;

type AuditLogQueryRow = Prisma.AuditLogGetPayload<{
    include: {
        user: {
            select: typeof AUDIT_LOG_USER_SELECT;
        };
    };
}>;

const AUDIT_ENTITY_HISTORY_SELECT = {
    id: true,
    action: true,
    userId: true,
    userEmail: true,
    details: true,
    createdAt: true,
} as const;

export async function appendAuditLog(
    command: AuditAppendCommand,
    persistenceContext: AuditLogPersistenceContext = prisma,
): Promise<void> {
    await persistenceContext.auditLog.create({
        data: {
            action: command.action,
            entityType: command.entityType,
            entityId: command.entityId,
            userId: command.userId,
            userEmail: command.userEmail,
            ipAddress: command.ipAddress,
            userAgent: command.userAgent,
            details: command.details ? JSON.stringify(command.details) : null,
        },
    });
}

export function findAuditLogs(
    where: Prisma.AuditLogWhereInput,
    skip: number,
    take: number,
    persistenceContext: AuditLogPersistenceContext = prisma,
): Promise<AuditLogQueryRow[]> {
    return persistenceContext.auditLog.findMany({
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
        take,
    });
}

export function findAuditEntityHistory(
    entityType: string,
    entityId: number,
    take: number,
    persistenceContext: AuditLogPersistenceContext = prisma,
): Promise<AuditEntityHistoryRow[]> {
    return persistenceContext.auditLog.findMany({
        where: { entityType, entityId },
        select: AUDIT_ENTITY_HISTORY_SELECT,
        orderBy: { createdAt: "desc" },
        take,
    });
}

export function countAuditLogs(
    where: Prisma.AuditLogWhereInput,
    persistenceContext: AuditLogPersistenceContext = prisma,
): Promise<number> {
    return persistenceContext.auditLog.count({ where });
}

export function deleteExpiredAuditLogs(
    cutoff: Date,
    persistenceContext: AuditLogPersistenceContext = prisma,
): Promise<Prisma.BatchPayload> {
    return persistenceContext.auditLog.deleteMany({
        where: {
            createdAt: {
                lt: cutoff,
            },
        },
    });
}
