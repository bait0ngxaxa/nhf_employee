import {
    assertMatchingEmailRequestHash,
    createEmailRequestHash,
} from "./idempotency";
import { persistEmailRequest } from "../../infrastructure/persistence/email-request-repository";
import type {
    CreateEmailRequestData,
    CreateEmailRequestOptions,
    CreateEmailRequestResult,
    UserContext,
    UpdateEmailRequestAccessResult,
} from "./types";
import { emailRequestSchema } from "../../domain/email-request/validation";
import { normalizeAccessRequirements, readStoredAccessRequirements, updateAccessRequirementsSchema } from "../../domain/email-request/access-requirements";
import { findEmailRequestForAccessUpdate, writeEmailRequestAccessUpdate } from "../../infrastructure/persistence/email-request-access-repository";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { appendAuditInTransaction } from "@/modules/audit";
import { EmailRequestCapabilityDeniedError, buildEmailRequestAuthorizationContext, resolveEmailRequestCapabilityInTransaction } from "./authorization";
import { EmailRequestAccessConflictError, EmailRequestNotFoundError } from "./access-errors";

export async function createEmailRequest(
    data: CreateEmailRequestData,
    user: UserContext,
    options: CreateEmailRequestOptions,
): Promise<CreateEmailRequestResult> {
    const validatedData = emailRequestSchema.parse(data);
    const requestHash = createEmailRequestHash(validatedData);
    const persisted = await persistEmailRequest(validatedData, {
        userId: user.id,
        idempotencyKey: options.idempotencyKey,
        requestHash,
    });

    assertMatchingEmailRequestHash(persisted, requestHash);
    return {
        success: true,
        emailRequest: persisted.emailRequest,
        replayed: persisted.replayed,
    };
}

export async function updateEmailRequestAccessRequirements(
    id: number,
    input: unknown,
    user: UserContext,
): Promise<UpdateEmailRequestAccessResult> {
    const parsed = updateAccessRequirementsSchema.parse(input);
    return runSerializableTransaction(async (tx) => {
        const context = buildEmailRequestAuthorizationContext(user);
        const grant = await resolveEmailRequestCapabilityInTransaction(context, "email.request.update", tx);
        const current = await findEmailRequestForAccessUpdate(tx, id);
        const canUpdate = grant.scopes.includes("ALL")
            || (grant.scopes.includes("OWN") && current?.requestedBy === user.id);
        if (!canUpdate) throw new EmailRequestCapabilityDeniedError("email.request.update", grant.decision.reason);
        if (!current) throw new EmailRequestNotFoundError();
        if (current.accessVersion !== parsed.expectedAccessVersion) throw new EmailRequestAccessConflictError();

        const before = readStoredAccessRequirements(current);
        const after = normalizeAccessRequirements({
            documentSystemDecision: parsed.documentSystemDecision,
            sharedDriveDecision: parsed.sharedDriveDecision,
            sharedDriveAccess: parsed.sharedDriveAccess,
        });
        if (JSON.stringify(before) === JSON.stringify(after)) {
            return { emailRequest: { ...current, ...before }, changed: false };
        }
        const accessVersion = current.accessVersion + 1;
        const emailRequest = await writeEmailRequestAccessUpdate(tx, {
            id, actorId: user.id, expectedAccessVersion: parsed.expectedAccessVersion,
            accessVersion, before, after,
        });
        if (!emailRequest) throw new EmailRequestAccessConflictError();
        await appendAuditInTransaction(tx, {
            action: "EMAIL_REQUEST", entityType: "EmailRequest", entityId: id,
            userId: user.id, userEmail: user.email,
            details: { before, after, metadata: { event: "access_requirements_updated", accessVersion, description: "อัปเดตสิทธิ์การใช้งานพนักงานใหม่" } },
        });
        return { emailRequest, changed: true };
    });
}
