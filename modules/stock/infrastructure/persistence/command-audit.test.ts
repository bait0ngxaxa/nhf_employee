import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { appendAuditInTransaction } from "@/modules/audit";
import { createStockCommandAudit } from "./command-audit";

vi.mock("@/modules/audit", () => ({
    appendAuditInTransaction: vi.fn(),
}));

const transaction = mockDeep<Prisma.TransactionClient>();
const actor = {
    id: 99,
    email: "admin@thainhf.org",
    name: "Admin",
    ipAddress: "203.0.113.20",
    userAgent: "stock-audit-test",
    requestId: "request-20",
    correlationId: "correlation-20",
};

describe("Stock transaction Audit producer", () => {
    beforeEach(() => {
        vi.mocked(appendAuditInTransaction).mockReset();
    });

    it("passes the transaction, actor trace, and mapped entity to Audit", async () => {
        await createStockCommandAudit(
            transaction,
            "STOCK_REQUEST_ISSUE",
            42,
            actor,
            {
                after: { status: "ISSUED" },
                metadata: { source: "test" },
            },
        );

        expect(appendAuditInTransaction).toHaveBeenCalledWith(transaction, {
            action: "STOCK_REQUEST_ISSUE",
            entityType: "StockRequest",
            entityId: 42,
            userId: 99,
            userEmail: "admin@thainhf.org",
            ipAddress: "203.0.113.20",
            userAgent: "stock-audit-test",
            details: {
                after: { status: "ISSUED" },
                metadata: {
                    source: "test",
                    requestId: "request-20",
                    correlationId: "correlation-20",
                },
            },
        });
    });

    it("does not add trace properties when no trace values exist", async () => {
        const details = { after: { status: "CREATED" } };
        await createStockCommandAudit(
            transaction,
            "STOCK_CATEGORY_CREATE",
            7,
            { ...actor, requestId: undefined, correlationId: undefined },
            details,
        );

        expect(appendAuditInTransaction).toHaveBeenCalledWith(transaction, {
            action: "STOCK_CATEGORY_CREATE",
            entityType: "StockCategory",
            entityId: 7,
            userId: 99,
            userEmail: "admin@thainhf.org",
            ipAddress: "203.0.113.20",
            userAgent: "stock-audit-test",
            details,
        });
    });

    it("propagates Audit failure to the enclosing strict transaction", async () => {
        const error = new Error("audit failed");
        vi.mocked(appendAuditInTransaction).mockRejectedValue(error);

        await expect(createStockCommandAudit(
            transaction,
            "STOCK_ADJUST",
            18,
            actor,
            { after: { quantity: 4 } },
        )).rejects.toBe(error);
    });
});
