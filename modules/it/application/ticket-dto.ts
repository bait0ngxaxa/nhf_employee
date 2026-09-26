import type {
    ITRequesterTicket,
    ITRequesterTicketDetail,
    ITTicketAttachmentSummary,
} from "../contracts";
import type { ITOperatorTicket, ITOperatorTicketDetail } from "../contracts";
import { getUserDisplayName } from "@/shared/identity/display";
import type {
    ITOperatorTicketDetailRecord,
    ITOperatorTicketRecord,
    ITRequesterTicketDetailRecord,
} from "../infrastructure/persistence/ticket-query-repository";
import type { ITTicketRecord } from "./types";

export function toITRequesterTicket(
    ticket: Pick<ITTicketRecord,
        "id" | "type" | "title" | "description" | "status"
        | "createdAt" | "updatedAt" | "resolvedAt"
    >,
): ITRequesterTicket {
    return Object.freeze({
        id: ticket.id,
        type: ticket.type,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    });
}

function toInitialAttachmentSummaries(
    attachments: readonly {
        readonly id: string;
        readonly originalName: string;
        readonly contentType: string;
        readonly sizeBytes: number;
        readonly width: number;
        readonly height: number;
        readonly position: number;
    }[],
): readonly ITTicketAttachmentSummary[] {
    return attachments.map((attachment) => {
        if (attachment.contentType !== "image/webp") {
            throw new Error("Invalid IT Ticket attachment content type");
        }
        return {
            id: attachment.id,
            originalName: attachment.originalName,
            contentType: "image/webp",
            sizeBytes: attachment.sizeBytes,
            width: attachment.width,
            height: attachment.height,
            position: attachment.position,
        };
    });
}

export function toITRequesterTicketDetail(
    ticket: ITRequesterTicketDetailRecord,
): ITRequesterTicketDetail {
    return {
        ...toITRequesterTicket(ticket),
        initialAttachments: toInitialAttachmentSummaries(ticket.attachments),
    };
}

/** Projects only the operator fields needed to process a Ticket. */
export function toITOperatorTicket(
    ticket: ITOperatorTicketRecord,
): ITOperatorTicket {
    const displayIdentity = (user: ITOperatorTicketRecord["requester"]): {
        readonly userId: number;
        readonly displayName: string;
    } => ({
        userId: user.id,
        displayName: getUserDisplayName(user, `ผู้ใช้งาน #${user.id}`),
    });

    return Object.freeze({
        id: ticket.id,
        type: ticket.type,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        requester: Object.freeze({
            ...displayIdentity(ticket.requester),
            departmentId: ticket.requesterDepartmentId,
            departmentNameSnapshot: ticket.requesterDepartmentNameSnapshot,
        }),
        assignee: ticket.assignedTo === null
            ? null
            : Object.freeze(displayIdentity(ticket.assignedTo)),
        category: ticket.category === null
            ? null
            : Object.freeze({
                id: ticket.category.id,
                key: ticket.category.key,
                name: ticket.category.name,
                isActive: ticket.category.isActive,
            }),
        version: ticket.version,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    });
}

export function toITOperatorTicketDetail(
    ticket: ITOperatorTicketDetailRecord,
): ITOperatorTicketDetail {
    return {
        ...toITOperatorTicket(ticket),
        initialAttachments: toInitialAttachmentSummaries(ticket.attachments),
    };
}
