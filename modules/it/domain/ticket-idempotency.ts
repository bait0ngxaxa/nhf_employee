import { createHash } from "node:crypto";

import type { ITTicketType } from "@prisma/client";

export interface CanonicalITTicketCreationInput {
    readonly type: ITTicketType;
    readonly title: string;
    readonly description: string;
}

export function createITTicketRequestHash(
    input: CanonicalITTicketCreationInput,
): string {
    const canonicalPayload = JSON.stringify({
        type: input.type,
        title: input.title,
        description: input.description,
    });
    return createHash("sha256").update(canonicalPayload).digest("hex");
}
