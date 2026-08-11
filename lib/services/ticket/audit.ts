import type { AuditAction, Prisma, Ticket } from "@prisma/client";

import {
    defineAuditDetails,
    type AuditDetails,
} from "@/lib/audit-log/contracts";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import type { UserContext } from "./types";

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;
type TicketAuditAction =
    | "TICKET_CREATE"
    | "TICKET_UPDATE"
    | "TICKET_STATUS_CHANGE"
    | "TICKET_ASSIGN"
    | "TICKET_COMMENT"
    | "TICKET_DELETE";

type TicketAuditDetails = AuditDetails;

type TicketWithOptionalAssignee = Ticket & {
    assignedTo?: {
        name: string;
        email: string;
        employee: {
            firstName: string;
            lastName: string;
            nickname: string | null;
        } | null;
    } | null;
};

const UPDATE_FIELDS = [
    "title",
    "description",
    "category",
    "priority",
] as const;

function requestMetadata(actor: UserContext): Record<string, unknown> {
    return {
        requestId: actor.requestId ?? null,
        correlationId: actor.correlationId ?? null,
    };
}

export async function createTicketAudit(
    client: AuditClient,
    action: TicketAuditAction,
    ticketId: number,
    actor: UserContext,
    details: TicketAuditDetails,
): Promise<void> {
    await client.auditLog.create({
        data: {
            action: action as AuditAction,
            entityType: "Ticket",
            entityId: ticketId,
            userId: actor.id,
            userEmail: actor.email,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
            details: JSON.stringify({
                ...details,
                metadata: {
                    ...details.metadata,
                    ...requestMetadata(actor),
                },
            }),
        },
    });
}

function changedValues(
    before: Ticket,
    after: Ticket,
    fields: readonly (keyof Ticket)[],
): TicketAuditDetails | null {
    const beforeValues: Record<string, unknown> = {};
    const afterValues: Record<string, unknown> = {};

    for (const field of fields) {
        const beforeValue = before[field];
        const afterValue = after[field];
        const isSameDate =
            beforeValue instanceof Date
            && afterValue instanceof Date
            && beforeValue.getTime() === afterValue.getTime();
        if (Object.is(beforeValue, afterValue) || isSameDate) continue;
        beforeValues[field] = beforeValue;
        afterValues[field] = afterValue;
    }

    return Object.keys(beforeValues).length > 0
        ? { before: beforeValues, after: afterValues }
        : null;
}

export async function auditTicketUpdate(
    client: AuditClient,
    before: TicketWithOptionalAssignee,
    after: TicketWithOptionalAssignee,
    actor: UserContext,
): Promise<void> {
    const assignmentChange = changedValues(before, after, ["assignedToId"]);
    const events: Array<{
        action: TicketAuditAction;
        details: TicketAuditDetails | null;
    }> = [
        {
            action: "TICKET_STATUS_CHANGE",
            details: changedValues(before, after, [
                "status",
                "resolvedAt",
                "closedAt",
                "cancelledAt",
            ]),
        },
        {
            action: "TICKET_ASSIGN",
            details: assignmentChange
                ? defineAuditDetails("TICKET_ASSIGN", {
                      before: {
                          assignedToId: before.assignedToId,
                      },
                      after: {
                          assignedToId: after.assignedToId,
                      },
                      metadata: {
                          ticketTitle: after.title,
                          previousAssigneeName: getAssigneeDisplayName(
                              before.assignedTo,
                          ),
                          newAssigneeName: getAssigneeDisplayName(
                              after.assignedTo,
                          ),
                      },
                  })
                : null,
        },
        {
            action: "TICKET_UPDATE",
            details: changedValues(before, after, UPDATE_FIELDS),
        },
    ];

    for (const event of events) {
        if (!event.details) continue;
        await createTicketAudit(
            client,
            event.action,
            after.id,
            actor,
            event.details,
        );
    }
}

function getAssigneeDisplayName(
    assignee: TicketWithOptionalAssignee["assignedTo"],
): string | null {
    if (!assignee) return null;
    return getEmployeeBackedUserDisplayName(assignee);
}
