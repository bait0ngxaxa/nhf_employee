import { Prisma, type ITTicket as PrismaITTicket } from "@prisma/client";

import {
    resolveITCapabilityInTransaction,
    ITCapabilityDeniedError,
    type ITAuthorizationContext,
} from "./authorization";
import { findITOperatorAudience } from "./operator-audience";
import type { ITTicketNotificationPayloadV1 } from "../domain/ticket-notification";
import { enqueueITTicketNotificationIntents } from "../infrastructure/notifications/outbox";
import { assertITActorCurrentWorkforce } from "./workforce";
import {
    ITTicketAssigneeNotEligibleError,
    ITTicketCategoryInactiveError,
    ITTicketCategoryNotFoundError,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketInvalidTransitionError,
    ITTicketMutationConflictError,
    ITTicketNotFoundError,
} from "./ticket-errors";
import {
    assignITTicketInputSchema,
    createITTicketInputSchema,
    setITTicketCategoryInputSchema,
    transitionITTicketStatusInputSchema,
    type CreateITTicketInput,
} from "./ticket-schemas";
import type {
    CreateITTicketResult,
    ITTicketMutationResult,
    ITTicketRecord,
} from "./types";
import { createITTicketRequestHash } from "../domain/ticket-idempotency";
import { isAllowedITTicketTransition } from "../domain/ticket-workflow";
import {
    deleteITTicketAttachmentFiles,
    writeITTicketAttachments,
} from "../infrastructure/attachments/storage";
import {
    prepareITTicketAttachments,
    type ITTicketAttachmentSource,
} from "../infrastructure/attachments/validation";
import type { StoredITTicketAttachment } from "../infrastructure/attachments/storage";
import { createITTicketAttachmentRows } from "../infrastructure/persistence/ticket-attachment-repository";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    createITTicketCreationIdempotency,
    createITTicketEvent,
    createITTicketRecord,
    findITTicketCategoryState,
    findITTicketCreationReplay,
    findITTicketForMutation,
    updateITTicketIfVersionMatches,
    type ITTicketPersistenceContext,
} from "../infrastructure/persistence/ticket-repository";

class ITTicketCreateIdempotencyRaceError extends Error {}

function toITTicketRecord(ticket: PrismaITTicket): ITTicketRecord {
    return Object.freeze({
        id: ticket.id,
        type: ticket.type,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        requesterUserId: ticket.requesterUserId,
        assignedToUserId: ticket.assignedToUserId,
        categoryId: ticket.categoryId,
        requesterDepartmentId: ticket.requesterDepartmentId,
        requesterDepartmentNameSnapshot:
            ticket.requesterDepartmentNameSnapshot,
        version: ticket.version,
        resolvedAt: ticket.resolvedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
    });
}

async function assertITCapabilityScope(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    capability: "it.ticket.create" | "it.ticket.manage",
    scope: "OWN" | "ALL",
): Promise<void> {
    const authorization = await resolveITCapabilityInTransaction(
        context,
        capability,
        tx,
    );
    if (!authorization.scopes.includes(scope)) {
        throw new ITCapabilityDeniedError(
            capability,
            authorization.decision.reason ?? "NO_APPLICABLE_GRANT",
        );
    }
}

async function assertITTicketCreationAuthority(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
) {
    const workforce = await assertITActorCurrentWorkforce(tx, context);
    await assertITCapabilityScope(tx, context, "it.ticket.create", "OWN");
    return workforce;
}

function parseCreateInput(input: unknown): CreateITTicketInput {
    const parsed = createITTicketInputSchema.safeParse(input);
    if (!parsed.success) throw new ITTicketInputValidationError();
    return parsed.data;
}

function parseInput<T>(
    schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
    input: unknown,
): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new ITTicketInputValidationError();
    return parsed.data;
}

async function findReplay(
    persistenceContext: ITTicketPersistenceContext,
    requesterUserId: number,
    idempotencyKey: string,
    requestHash: string,
): Promise<CreateITTicketResult | null> {
    const existing = await findITTicketCreationReplay(
        persistenceContext,
        requesterUserId,
        idempotencyKey,
    );
    if (existing === null) return null;
    if (existing.requestHash !== requestHash) {
        throw new ITTicketIdempotencyConflictError();
    }
    return { ticket: toITTicketRecord(existing.ticket), replayed: true };
}

/** Creates an OPEN Ticket, its CREATED event, and its idempotency record atomically. */
export async function createITTicket(
    context: ITAuthorizationContext,
    input: unknown,
    options: {
        readonly idempotencyKey: string;
        readonly attachments?: readonly ITTicketAttachmentSource[];
    },
): Promise<CreateITTicketResult> {
    const canonicalInput = parseCreateInput(input);
    const parsedKey = idempotencyKeySchema.safeParse(options.idempotencyKey);
    if (!parsedKey.success) throw new ITTicketInputValidationError();
    const idempotencyKey = parsedKey.data;
    const requesterUserId = context.authorizationActor.userId;
    const attachmentSources = options.attachments ?? [];

    if (attachmentSources.length > 0) {
        await prisma.$transaction(async (tx) => {
            await assertITTicketCreationAuthority(tx, context);
        });
    }

    const preparedAttachments = await prepareITTicketAttachments(attachmentSources);
    const requestHash = createITTicketRequestHash({
        ...canonicalInput,
        attachments: preparedAttachments.map((attachment) => ({
            originalName: attachment.originalName,
            contentSha256: attachment.contentSha256,
        })),
    });

    if (preparedAttachments.length > 0) {
        const replay = await prisma.$transaction(async (tx) => {
            await assertITTicketCreationAuthority(tx, context);
            return findReplay(tx, requesterUserId, idempotencyKey, requestHash);
        });
        if (replay !== null) return replay;
    }

    let storedAttachments: StoredITTicketAttachment[] = [];
    let transactionCallbackCompleted = false;

    const createWithinTransaction = async (
        tx: Prisma.TransactionClient,
    ): Promise<CreateITTicketResult> => {
        const workforce = await assertITTicketCreationAuthority(tx, context);

        const replay = await findReplay(
            tx,
            requesterUserId,
            idempotencyKey,
            requestHash,
        );
        if (replay !== null) return replay;

        const occurredAt = new Date();
        const ticket = await createITTicketRecord(tx, {
            type: canonicalInput.type,
            title: canonicalInput.title,
            description: canonicalInput.description,
            status: "OPEN",
            requesterUserId,
            assignedToUserId: null,
            categoryId: null,
            requesterDepartmentId: workforce.departmentId,
            requesterDepartmentNameSnapshot: workforce.departmentName,
            version: 1,
            resolvedAt: null,
            createdAt: occurredAt,
            updatedAt: occurredAt,
        });

        const eventId = await createITTicketEvent(tx, {
            ticketId: ticket.id,
            actorUserId: requesterUserId,
            kind: "CREATED",
            occurredAt,
        });

        if (preparedAttachments.length > 0) {
            storedAttachments = await writeITTicketAttachments(ticket.id, preparedAttachments);
            if (storedAttachments.length !== preparedAttachments.length) {
                throw new Error("IT Ticket attachment storage returned an incomplete result");
            }
            await createITTicketAttachmentRows(tx, storedAttachments.map((attachment) => ({
                id: attachment.id,
                ticketId: ticket.id,
                commentId: null,
                uploaderUserId: requesterUserId,
                position: attachment.position,
                storageKey: attachment.storageKey,
                originalName: attachment.originalName,
                contentType: attachment.contentType,
                contentSha256: attachment.contentSha256,
                sizeBytes: attachment.sizeBytes,
                width: attachment.width,
                height: attachment.height,
            })));
        }

        try {
            await createITTicketCreationIdempotency(tx, {
                requesterUserId,
                idempotencyKey,
                requestHash,
                ticketId: ticket.id,
                createdAt: occurredAt,
            });
        } catch (error) {
            if (hasPrismaErrorCode(error, "P2002")) {
                throw new ITTicketCreateIdempotencyRaceError();
            }
            throw error;
        }

        const operatorAudience = await findITOperatorAudience(tx);
        const notifications: ITTicketNotificationPayloadV1[] = operatorAudience
            .filter((operator) => operator.userId !== requesterUserId)
            .map((operator) => ({
                version: 1,
                event: "CREATED",
                ticketId: ticket.id,
                recipientUserId: operator.userId,
                audience: "OPERATOR_QUEUE",
                source: { kind: "EVENT", id: eventId },
            }));
        await enqueueITTicketNotificationIntents(tx, notifications);

        return { ticket: toITTicketRecord(ticket), replayed: false };
    };

    try {
        if (preparedAttachments.length === 0) {
            return await runSerializableTransaction(createWithinTransaction);
        }

        return await prisma.$transaction(async (tx) => {
            const result = await createWithinTransaction(tx);
            transactionCallbackCompleted = true;
            return result;
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10_000,
            timeout: 30_000,
        });
    } catch (error) {
        if (storedAttachments.length > 0) {
            if (transactionCallbackCompleted) {
                let committedRows: readonly { readonly storageKey: string }[] | null = null;
                try {
                    committedRows = await prisma.iTTicketAttachment.findMany({
                        where: {
                            storageKey: { in: storedAttachments.map((attachment) => attachment.storageKey) },
                        },
                        select: { storageKey: true },
                    });
                } catch {
                    console.error("Could not verify IT Ticket creation attachment commit");
                    throw error;
                }

                const committedKeys = new Set(committedRows.map((row) => row.storageKey));
                const uncommittedKeys = storedAttachments
                    .filter((attachment) => !committedKeys.has(attachment.storageKey))
                    .map((attachment) => attachment.storageKey);

                if (committedRows.length > 0) {
                    if (uncommittedKeys.length > 0) {
                        await deleteITTicketAttachmentFiles(uncommittedKeys);
                    }
                    if (uncommittedKeys.length === 0) {
                        const replay = await findReplay(
                            prisma,
                            requesterUserId,
                            idempotencyKey,
                            requestHash,
                        );
                        if (replay !== null) return replay;
                    }
                    throw error;
                }
            }
            await deleteITTicketAttachmentFiles(
                storedAttachments.map((attachment) => attachment.storageKey),
            );
        }

        const creationRace = error instanceof ITTicketCreateIdempotencyRaceError
            || hasPrismaErrorCode(error, "P2034");
        if (!creationRace) throw error;

        const replay = await findReplay(
            prisma,
            requesterUserId,
            idempotencyKey,
            requestHash,
        );
        if (replay !== null) return replay;
        throw new ITTicketMutationConflictError("CONCURRENT_WRITE");
    }
}

async function assertOperatorAuthority(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
): Promise<void> {
    await assertITActorCurrentWorkforce(tx, context);
    await assertITCapabilityScope(
        tx,
        context,
        "it.ticket.manage",
        "ALL",
    );
}

async function runOperatorMutation<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    try {
        return await runSerializableTransaction(callback);
    } catch (error) {
        if (hasPrismaErrorCode(error, "P2034")) {
            throw new ITTicketMutationConflictError("CONCURRENT_WRITE");
        }
        throw error;
    }
}

async function loadTicketAtVersion(
    tx: ITTicketPersistenceContext,
    ticketId: number,
    expectedVersion: number,
): Promise<PrismaITTicket> {
    const ticket = await findITTicketForMutation(tx, ticketId);
    if (ticket === null) throw new ITTicketNotFoundError();
    if (ticket.version !== expectedVersion) {
        throw new ITTicketMutationConflictError("STALE_VERSION");
    }
    return ticket;
}

async function saveMutationAndEvent(
    tx: ITTicketPersistenceContext,
    ticket: PrismaITTicket,
    expectedVersion: number,
    actorUserId: number,
    occurredAt: Date,
    update: Prisma.ITTicketUncheckedUpdateManyInput,
    event: Omit<
        Prisma.ITTicketEventUncheckedCreateInput,
        "ticketId" | "actorUserId"
    >,
    afterEvent?: (eventId: number) => Promise<void>,
): Promise<ITTicketMutationResult> {
    const updated = await updateITTicketIfVersionMatches(
        tx,
        ticket.id,
        expectedVersion,
        { ...update, updatedAt: occurredAt, version: { increment: 1 } },
    );
    if (!updated) throw new ITTicketMutationConflictError("CONCURRENT_WRITE");

    const eventId = await createITTicketEvent(tx, {
        ...event,
        ticketId: ticket.id,
        actorUserId,
        occurredAt,
    });
    if (afterEvent) await afterEvent(eventId);
    const updatedTicket = await findITTicketForMutation(tx, ticket.id);
    if (updatedTicket === null) throw new ITTicketNotFoundError();

    return { ticket: toITTicketRecord(updatedTicket), changed: true };
}

/** Executes only an IT2-approved status transition under current manage authority. */
export async function transitionITTicketStatus(
    context: ITAuthorizationContext,
    input: unknown,
): Promise<ITTicketMutationResult> {
    const command = parseInput(transitionITTicketStatusInputSchema, input);
    return runOperatorMutation(async (tx) => {
        await assertOperatorAuthority(tx, context);
        const ticket = await loadTicketAtVersion(
            tx,
            command.ticketId,
            command.expectedVersion,
        );
        if (!isAllowedITTicketTransition(ticket.status, command.targetStatus)) {
            throw new ITTicketInvalidTransitionError();
        }

        const occurredAt = new Date();
        const shouldNotifyRequester =
            (command.targetStatus === "WAITING_REQUESTER"
                || command.targetStatus === "RESOLVED")
            && ticket.requesterUserId !== context.authorizationActor.userId;

        return saveMutationAndEvent(
            tx,
            ticket,
            command.expectedVersion,
            context.authorizationActor.userId,
            occurredAt,
            {
                status: command.targetStatus,
                ...(command.targetStatus === "RESOLVED"
                    ? { resolvedAt: occurredAt }
                    : {}),
            },
            {
                kind: "STATUS_CHANGED",
                fromStatus: ticket.status,
                toStatus: command.targetStatus,
            },
            shouldNotifyRequester
                ? (eventId) => enqueueITTicketNotificationIntents(tx, [{
                    version: 1,
                    event: command.targetStatus === "WAITING_REQUESTER"
                        ? "WAITING_REQUESTER"
                        : "RESOLVED",
                    ticketId: ticket.id,
                    recipientUserId: ticket.requesterUserId,
                    audience: "REQUESTER",
                    source: { kind: "EVENT", id: eventId },
                }])
                : undefined,
        );
    });
}

async function assertEligibleAssignee(
    tx: Prisma.TransactionClient,
    assigneeUserId: number,
): Promise<void> {
    const eligible = (await findITOperatorAudience(tx)).some(
        (operator) => operator.userId === assigneeUserId,
    );
    if (!eligible) throw new ITTicketAssigneeNotEligibleError();
}

/** Assigns, reassigns, or unassigns a Ticket with version protection. */
export async function assignITTicket(
    context: ITAuthorizationContext,
    input: unknown,
): Promise<ITTicketMutationResult> {
    const command = parseInput(assignITTicketInputSchema, input);
    return runOperatorMutation(async (tx) => {
        await assertOperatorAuthority(tx, context);
        const ticket = await loadTicketAtVersion(
            tx,
            command.ticketId,
            command.expectedVersion,
        );
        if (ticket.assignedToUserId === command.assigneeUserId) {
            return { ticket: toITTicketRecord(ticket), changed: false };
        }
        if (command.assigneeUserId !== null) {
            await assertEligibleAssignee(tx, command.assigneeUserId);
        }

        const occurredAt = new Date();
        const actorUserId = context.authorizationActor.userId;
        const newAssigneeUserId = command.assigneeUserId;
        const notifyNewAssignee = newAssigneeUserId !== null
            && newAssigneeUserId !== actorUserId;

        return saveMutationAndEvent(
            tx,
            ticket,
            command.expectedVersion,
            context.authorizationActor.userId,
            occurredAt,
            { assignedToUserId: command.assigneeUserId },
            {
                kind: command.assigneeUserId === null ? "UNASSIGNED" : "ASSIGNED",
                fromAssigneeUserId: ticket.assignedToUserId,
                toAssigneeUserId: command.assigneeUserId,
            },
            notifyNewAssignee
                ? (eventId) => enqueueITTicketNotificationIntents(tx, [{
                    version: 1,
                    event: "ASSIGNED",
                    ticketId: ticket.id,
                    recipientUserId: newAssigneeUserId,
                    audience: "ASSIGNEE",
                    source: { kind: "EVENT", id: eventId },
                }])
                : undefined,
        );
    });
}

/** Sets or clears an active category with version protection and an event. */
export async function setITTicketCategory(
    context: ITAuthorizationContext,
    input: unknown,
): Promise<ITTicketMutationResult> {
    const command = parseInput(setITTicketCategoryInputSchema, input);
    return runOperatorMutation(async (tx) => {
        await assertOperatorAuthority(tx, context);
        const ticket = await loadTicketAtVersion(
            tx,
            command.ticketId,
            command.expectedVersion,
        );
        if (ticket.categoryId === command.categoryId) {
            return { ticket: toITTicketRecord(ticket), changed: false };
        }

        if (command.categoryId !== null) {
            const category = await findITTicketCategoryState(tx, command.categoryId);
            if (category === null) throw new ITTicketCategoryNotFoundError();
            if (!category.isActive) throw new ITTicketCategoryInactiveError();
        }

        const occurredAt = new Date();
        return saveMutationAndEvent(
            tx,
            ticket,
            command.expectedVersion,
            context.authorizationActor.userId,
            occurredAt,
            { categoryId: command.categoryId },
            {
                kind: "CATEGORY_CHANGED",
                fromCategoryId: ticket.categoryId,
                toCategoryId: command.categoryId,
            },
        );
    });
}
