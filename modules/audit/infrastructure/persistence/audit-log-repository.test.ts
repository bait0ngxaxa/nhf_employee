import type { AuditAction, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import type {
    AuditAppendCommand,
    AuditLogPersistenceContext,
} from "../../application/contracts";
import {
    appendAuditLog,
    countAuditLogs,
    deleteExpiredAuditLogs,
    findAuditEntityHistory,
    findAuditLogs,
} from "./audit-log-repository";

const persistenceContext = mockDeep<Prisma.TransactionClient>();
const auditContext = persistenceContext as AuditLogPersistenceContext;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

const command: AuditAppendCommand = {
    action: "EMPLOYEE_CREATE" as AuditAction,
    entityType: "Employee",
    entityId: 17,
    userId: 3,
    userEmail: "admin@thainhf.org",
    ipAddress: "203.0.113.7",
    userAgent: "test-agent",
    details: {
        before: { status: "PENDING" },
        after: { status: "ACTIVE" },
        metadata: { requestId: "request-17" },
    },
};

describe("AuditLog persistence repository", () => {
    beforeEach(() => {
        mockReset(persistenceContext);
        persistenceContext.auditLog.create.mockResolvedValue(asNever({}));
        persistenceContext.auditLog.findMany.mockResolvedValue(asNever([]));
        persistenceContext.auditLog.count.mockResolvedValue(0);
        persistenceContext.auditLog.deleteMany.mockResolvedValue({ count: 0 });
    });

    it("serializes generic details through the supplied persistence context", async () => {
        await appendAuditLog(command, auditContext);

        expect(persistenceContext.auditLog.create).toHaveBeenCalledWith({
            data: {
                action: command.action,
                entityType: command.entityType,
                entityId: command.entityId,
                userId: command.userId,
                userEmail: command.userEmail,
                ipAddress: command.ipAddress,
                userAgent: command.userAgent,
                details: JSON.stringify(command.details),
            },
        });
    });

    it("preserves the generic query projection, ordering, and offset arguments", async () => {
        const where: Prisma.AuditLogWhereInput = {
            action: "EMPLOYEE_CREATE",
        };

        await findAuditLogs(where, 20, 10, auditContext);

        expect(persistenceContext.auditLog.findMany).toHaveBeenCalledWith({
            where,
            include: {
                user: {
                    select: {
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
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: 20,
            take: 10,
        });
    });

    it("preserves the narrow entity-history projection and raw details", async () => {
        await findAuditEntityHistory(
            "RoutineOccurrence",
            91,
            100,
            auditContext,
        );

        expect(persistenceContext.auditLog.findMany).toHaveBeenCalledWith({
            where: { entityType: "RoutineOccurrence", entityId: 91 },
            select: {
                id: true,
                action: true,
                userId: true,
                userEmail: true,
                details: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    });

    it("counts with the same generic query predicate", async () => {
        const where: Prisma.AuditLogWhereInput = { userId: 3 };

        await countAuditLogs(where, auditContext);

        expect(persistenceContext.auditLog.count).toHaveBeenCalledWith({ where });
    });

    it("deletes only rows strictly older than the supplied cutoff", async () => {
        const cutoff = new Date("2026-04-07T12:00:00.000Z");

        await deleteExpiredAuditLogs(cutoff, auditContext);

        expect(persistenceContext.auditLog.deleteMany).toHaveBeenCalledWith({
            where: { createdAt: { lt: cutoff } },
        });
    });
});
