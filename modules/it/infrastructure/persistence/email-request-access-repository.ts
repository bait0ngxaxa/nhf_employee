import type { EmailRequest, Prisma } from "@prisma/client";
import type { AccessRequirements } from "../../domain/email-request/access-requirements";

type EmailRequestAccessPersistenceContext = Pick<Prisma.TransactionClient,
    "emailRequest" | "emailRequestAccessChange" | "notificationOutbox">;

export function findEmailRequestForAccessUpdate(
    tx: EmailRequestAccessPersistenceContext,
    id: number,
): Promise<EmailRequest | null> {
    return tx.emailRequest.findUnique({ where: { id } });
}

/** A successful compare-and-swap appends the immutable history and parent fact in the caller's transaction. */
export async function writeEmailRequestAccessUpdate(
    tx: EmailRequestAccessPersistenceContext,
    input: {
        id: number;
        actorId: number;
        expectedAccessVersion: number;
        accessVersion: number;
        before: AccessRequirements;
        after: AccessRequirements;
    },
): Promise<EmailRequest | null> {
    const updated = await tx.emailRequest.updateMany({
        where: { id: input.id, accessVersion: input.expectedAccessVersion },
        data: {
            ...input.after,
            needsDocumentSystem: input.after.documentSystemDecision === "REQUIRED",
            accessVersion: input.accessVersion,
        },
    });
    if (updated.count !== 1) return null;
    await tx.emailRequestAccessChange.create({ data: {
        emailRequestId: input.id,
        actorId: input.actorId,
        accessVersion: input.accessVersion,
        before: input.before,
        after: input.after,
    } });
    await tx.notificationOutbox.create({ data: {
        type: "EMAIL_REQUEST_ACCESS_UPDATED",
        eventKey: `email-request:${input.id}:access:${input.accessVersion}`,
        payload: JSON.stringify({ version: 1, emailRequestId: input.id, accessVersion: input.accessVersion }),
    } });
    return findEmailRequestForAccessUpdate(tx, input.id);
}
