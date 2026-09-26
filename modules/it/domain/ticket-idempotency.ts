import { createHash } from "node:crypto";

import type { ITTicketType } from "@prisma/client";

export interface CanonicalITTicketCreationInput {
    readonly type: ITTicketType;
    readonly title: string;
    readonly description: string;
    readonly attachments?: readonly {
        readonly originalName: string;
        readonly contentSha256: string;
    }[];
}

export function createITTicketRequestHash(
    input: CanonicalITTicketCreationInput,
): string {
    const canonicalPayload = JSON.stringify({
        type: input.type,
        title: input.title,
        description: input.description,
        ...(input.attachments && input.attachments.length > 0
            ? { attachments: input.attachments }
            : {}),
    });
    return createHash("sha256").update(canonicalPayload).digest("hex");
}
