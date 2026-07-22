import type { Prisma } from "@prisma/client";

import type { AuditLogDetails } from "@/lib/server/audit";
import {
    getStockAuditEntityType,
    type StockAuditAction,
    type StockAuditEntityType,
} from "@/lib/audit-log/stock-entity";
import type { StockCommandActor } from "./types";

function addTraceMetadata(
    details: AuditLogDetails | undefined,
    actor: StockCommandActor,
): AuditLogDetails | undefined {
    const traceMetadata = {
        ...(actor.requestId && { requestId: actor.requestId }),
        ...(actor.correlationId && { correlationId: actor.correlationId }),
    };
    if (Object.keys(traceMetadata).length === 0) return details;

    return {
        ...details,
        metadata: {
            ...details?.metadata,
            ...traceMetadata,
        },
    };
}

export async function createStockCommandAudit(
    tx: Prisma.TransactionClient,
    action: StockAuditAction,
    entityId: number,
    actor: StockCommandActor,
    details?: AuditLogDetails,
    entityType: StockAuditEntityType = getStockAuditEntityType(action),
): Promise<void> {
    const tracedDetails = addTraceMetadata(details, actor);
    await tx.auditLog.create({
        data: {
            action,
            entityType,
            entityId,
            userId: actor.id,
            userEmail: actor.email,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
            details: tracedDetails ? JSON.stringify(tracedDetails) : null,
        },
    });
}

export async function createStockVariantAudit(
    tx: Prisma.TransactionClient,
    action: Extract<StockAuditAction, "STOCK_ITEM_CREATE" | "STOCK_ITEM_UPDATE" | "STOCK_ITEM_DELETE">,
    variantId: number,
    actor: StockCommandActor,
    details: AuditLogDetails,
): Promise<void> {
    await createStockCommandAudit(
        tx,
        action,
        variantId,
        actor,
        details,
        "StockVariant",
    );
}
