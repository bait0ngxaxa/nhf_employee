import type { Prisma } from "@prisma/client";

import { appendAuditInTransaction, type AuditDetails } from "@/modules/audit";
import {
    getStockAuditEntityType,
    type StockAuditAction,
    type StockAuditEntityType,
} from "../../domain/audit";
import type { StockCommandActor } from "../../domain/types";

function addTraceMetadata(
    details: AuditDetails | undefined,
    actor: StockCommandActor,
): AuditDetails | undefined {
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
    details?: AuditDetails,
    entityType: StockAuditEntityType = getStockAuditEntityType(action),
): Promise<void> {
    const tracedDetails = addTraceMetadata(details, actor);
    await appendAuditInTransaction(tx, {
        action,
        entityType,
        entityId,
        userId: actor.id,
        userEmail: actor.email,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        details: tracedDetails,
    });
}

export async function createStockVariantAudit(
    tx: Prisma.TransactionClient,
    action: Extract<StockAuditAction, "STOCK_ITEM_CREATE" | "STOCK_ITEM_UPDATE" | "STOCK_ITEM_DELETE">,
    variantId: number,
    actor: StockCommandActor,
    details: AuditDetails,
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
