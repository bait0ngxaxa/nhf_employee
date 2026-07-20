import type { AuditAction, Prisma } from "@prisma/client";

import type { AuditLogDetails } from "@/lib/server/audit";
import type { StockCommandActor } from "./types";

type StockAuditAction = Extract<
    AuditAction,
    | "STOCK_ADJUST"
    | "STOCK_REQUEST_CREATE"
    | "STOCK_REQUEST_ISSUE"
    | "STOCK_REQUEST_CANCEL"
>;

export async function createStockCommandAudit(
    tx: Prisma.TransactionClient,
    action: StockAuditAction,
    entityId: number,
    actor: StockCommandActor,
    details?: AuditLogDetails,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            action,
            entityType: "Stock",
            entityId,
            userId: actor.id,
            userEmail: actor.email,
            details: details ? JSON.stringify(details) : null,
        },
    });
}
