import type { AuditAction, Prisma } from "@prisma/client";

import type { RoutineCommandActor } from "./types";

export async function createRoutineAuditInTransaction(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    entityType: "RoutineTask" | "RoutineOccurrence",
    entityId: number,
    actor: RoutineCommandActor,
    details: Record<string, unknown>,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            action,
            entityType,
            entityId,
            userId: actor.id,
            userEmail: actor.email,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
            details: JSON.stringify({
                ...details,
                metadata: {
                    requestId: actor.requestId ?? null,
                    correlationId: actor.correlationId ?? null,
                },
            }),
        },
    });
}
