import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import type { AuditAppendCommand } from "./contracts";
import {
    appendAuditBestEffort,
    appendAuditInTransaction,
} from "./commands";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const transaction = mockDeep<Prisma.TransactionClient>();

const command: AuditAppendCommand = {
    action: "EMPLOYEE_CREATE" as AuditAction,
    entityType: "Employee",
    entityId: 17,
    userId: 3,
    userEmail: "admin@thainhf.org",
    ipAddress: "203.0.113.7",
    userAgent: "test-agent",
    details: {
        after: { name: "Employee" },
        metadata: { requestId: "request-17" },
    },
};

describe("Audit append commands", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        mockReset(transaction);
        vi.restoreAllMocks();
    });

    it("uses the supplied transaction context and propagates persistence failure", async () => {
        const databaseError = new Error("audit insert failed");
        transaction.auditLog.create.mockRejectedValue(databaseError);

        await expect(
            appendAuditInTransaction(transaction, command),
        ).rejects.toBe(databaseError);

        expect(transaction.auditLog.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("keeps best-effort persistence failures out of the caller's success path", async () => {
        const databaseError = new Error("audit insert failed");
        prismaMock.auditLog.create.mockRejectedValue(databaseError);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(appendAuditBestEffort(command)).resolves.toBeUndefined();

        expect(errorSpy).toHaveBeenCalledWith(
            "[AuditLog] Failed to create audit log:",
            {
                action: command.action,
                entityType: command.entityType,
                entityId: command.entityId,
                error: databaseError.message,
            },
        );
    });
});
