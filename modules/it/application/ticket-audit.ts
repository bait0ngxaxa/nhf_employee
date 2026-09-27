import type { Prisma } from "@prisma/client";

import { appendAuditInTransaction, type AuditDetails } from "@/modules/audit";
import type { ITAuthorizationContext } from "./authorization";
import type { ITCommandRequestMetadata, ITTicketRecord } from "./types";

async function appendITTicketAudit(
    tx: Prisma.TransactionClient,
    action: "TICKET_CREATE" | "TICKET_UPDATE" | "TICKET_STATUS_CHANGE" | "TICKET_ASSIGN" | "TICKET_COMMENT",
    ticketId: number,
    context: ITAuthorizationContext,
    requestMetadata: ITCommandRequestMetadata | undefined,
    details: AuditDetails,
): Promise<void> {
    const traceMetadata = {
        channel: context.authorizationActor.channel,
        ...(requestMetadata?.requestId === undefined
            ? {}
            : { requestId: requestMetadata.requestId }),
        ...(requestMetadata?.correlationId === undefined
            ? {}
            : { correlationId: requestMetadata.correlationId }),
    };

    await appendAuditInTransaction(tx, {
        action,
        entityType: "ITTicket",
        entityId: ticketId,
        userId: context.authorizationActor.userId,
        userEmail: requestMetadata?.userEmail,
        ipAddress: requestMetadata?.ipAddress,
        userAgent: requestMetadata?.userAgent,
        details: {
            ...details,
            metadata: {
                ...details.metadata,
                ...traceMetadata,
            },
        },
    });
}

export function createITTicketCreationAudit(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    requestMetadata: ITCommandRequestMetadata | undefined,
    ticket: ITTicketRecord,
    attachmentCount: number,
): Promise<void> {
    return appendITTicketAudit(tx, "TICKET_CREATE", ticket.id, context, requestMetadata, {
        after: {
            type: ticket.type,
            status: ticket.status,
            requesterUserId: ticket.requesterUserId,
            assignedToUserId: ticket.assignedToUserId,
            categoryId: ticket.categoryId,
            requesterDepartmentId: ticket.requesterDepartmentId,
            attachmentCount,
        },
    });
}

export function createITTicketAssignmentAudit(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    requestMetadata: ITCommandRequestMetadata | undefined,
    ticketId: number,
    beforeAssignedToUserId: number | null,
    afterAssignedToUserId: number | null,
): Promise<void> {
    return appendITTicketAudit(tx, "TICKET_ASSIGN", ticketId, context, requestMetadata, {
        before: { assignedToUserId: beforeAssignedToUserId },
        after: { assignedToUserId: afterAssignedToUserId },
    });
}

export function createITTicketStatusAudit(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    requestMetadata: ITCommandRequestMetadata | undefined,
    before: Pick<ITTicketRecord, "id" | "status" | "resolvedAt">,
    after: Pick<ITTicketRecord, "status" | "resolvedAt">,
): Promise<void> {
    return appendITTicketAudit(tx, "TICKET_STATUS_CHANGE", before.id, context, requestMetadata, {
        before: {
            status: before.status,
            resolvedAt: before.resolvedAt?.toISOString() ?? null,
        },
        after: {
            status: after.status,
            resolvedAt: after.resolvedAt?.toISOString() ?? null,
        },
    });
}

export function createITTicketCategoryAudit(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    requestMetadata: ITCommandRequestMetadata | undefined,
    ticketId: number,
    beforeCategoryId: number | null,
    afterCategoryId: number | null,
): Promise<void> {
    return appendITTicketAudit(tx, "TICKET_UPDATE", ticketId, context, requestMetadata, {
        before: { categoryId: beforeCategoryId },
        after: { categoryId: afterCategoryId },
        metadata: { change: "CATEGORY" },
    });
}

export function createITTicketCommentAudit(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    requestMetadata: ITCommandRequestMetadata | undefined,
    ticketId: number,
    commentId: string,
    authorSide: "REQUESTER" | "OPERATOR",
    attachmentCount: number,
): Promise<void> {
    return appendITTicketAudit(tx, "TICKET_COMMENT", ticketId, context, requestMetadata, {
        after: { commentId, authorSide, attachmentCount },
    });
}
