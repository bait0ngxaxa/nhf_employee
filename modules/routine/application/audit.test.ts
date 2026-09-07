import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { appendAuditInTransaction } from "@/modules/audit";
import { createRoutineAuditInTransaction } from "./audit";

vi.mock("@/modules/audit", () => ({
    appendAuditInTransaction: vi.fn(),
}));

const transaction = mockDeep<Prisma.TransactionClient>();
const actor = {
    id: 99,
    role: "ADMIN",
    email: "admin@thainhf.org",
    ipAddress: "203.0.113.30",
    userAgent: "routine-audit-test",
    requestId: undefined,
    correlationId: undefined,
};

describe("Routine transaction Audit producer", () => {
    beforeEach(() => {
        vi.mocked(appendAuditInTransaction).mockReset();
    });

    it("passes the caller transaction and preserves null trace metadata", async () => {
        await createRoutineAuditInTransaction(
            transaction,
            "ROUTINE_OCCURRENCE_REASSIGN",
            "RoutineOccurrence",
            91,
            actor,
            { after: { employeeId: 21 } },
        );

        expect(appendAuditInTransaction).toHaveBeenCalledWith(transaction, {
            action: "ROUTINE_OCCURRENCE_REASSIGN",
            entityType: "RoutineOccurrence",
            entityId: 91,
            userId: 99,
            userEmail: "admin@thainhf.org",
            ipAddress: "203.0.113.30",
            userAgent: "routine-audit-test",
            details: {
                after: { employeeId: 21 },
                metadata: {
                    requestId: null,
                    correlationId: null,
                },
            },
        });
    });

    it("propagates Audit failure to the enclosing strict transaction", async () => {
        const error = new Error("audit failed");
        vi.mocked(appendAuditInTransaction).mockRejectedValue(error);

        await expect(createRoutineAuditInTransaction(
            transaction,
            "ROUTINE_TASK_UPDATE",
            "RoutineTask",
            71,
            actor,
            { after: { title: "Updated" } },
        )).rejects.toBe(error);
    });
});
