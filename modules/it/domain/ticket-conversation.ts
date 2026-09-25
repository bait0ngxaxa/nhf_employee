import { createHash } from "node:crypto";

import type { ITTicketCommentKind, ITTicketStatus } from "@prisma/client";
import { IT_TICKET_COMMENTABLE_STATUSES } from "../contracts";

export interface CanonicalITTicketCommentInput {
    readonly ticketId: number;
    readonly authorSide: ITTicketCommentKind;
    readonly body: string;
    readonly attachments?: readonly {
        readonly originalName: string;
        readonly contentSha256: string;
    }[];
}

export function isITTicketCommentableStatus(status: ITTicketStatus): boolean {
    return IT_TICKET_COMMENTABLE_STATUSES.some((candidate) => candidate === status);
}

export function createITTicketCommentRequestHash(
    input: CanonicalITTicketCommentInput,
): string {
    const canonicalPayload = input.attachments?.length
        ? JSON.stringify({
            version: 2,
            ticketId: input.ticketId,
            authorSide: input.authorSide,
            body: input.body,
            attachments: input.attachments.map((attachment, position) => ({
                position,
                originalName: attachment.originalName,
                contentSha256: attachment.contentSha256,
            })),
        })
        : JSON.stringify({
            ticketId: input.ticketId,
            authorSide: input.authorSide,
            body: input.body,
        });
    return createHash("sha256").update(canonicalPayload).digest("hex");
}

/** Rejects unpaired UTF-16 surrogates without normalizing or changing Unicode. */
export function isWellFormedITCommentText(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
        const codeUnit = value.charCodeAt(index);
        if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
            index += 1;
        } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
            return false;
        }
    }
    return true;
}
