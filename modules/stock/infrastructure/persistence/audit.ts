import { createAuditLog, type AuditLogDetails } from "@/lib/server/audit";

import {
    getStockAuditEntityType,
    type StockAuditAction,
} from "../../domain/audit";

/**
 * Create a Stock audit event through the generic audit persistence adapter.
 */
export async function logStockEvent(
    action: StockAuditAction,
    entityId: number,
    userId: number,
    userEmail: string,
    details?: AuditLogDetails,
): Promise<void> {
    await createAuditLog({
        action,
        entityType: getStockAuditEntityType(action),
        entityId,
        userId,
        userEmail,
        details,
    });
}
