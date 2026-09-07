import type { AuditAction, Prisma } from "@prisma/client";

import { appendAuditInTransaction } from "@/modules/audit";
import type { RoutineCommandActor } from "./types";

export async function createRoutineAuditInTransaction(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    entityType: "RoutineTask" | "RoutineOccurrence",
    entityId: number,
    actor: RoutineCommandActor,
    details: Record<string, unknown>,
): Promise<void> {
    await appendAuditInTransaction(tx, {
        action,
        entityType,
        entityId,
        userId: actor.id,
        userEmail: actor.email,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        details: {
            ...details,
            metadata: {
                requestId: actor.requestId ?? null,
                correlationId: actor.correlationId ?? null,
            },
        },
    });
}
