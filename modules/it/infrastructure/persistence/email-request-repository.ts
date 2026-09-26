import { cache } from "react";
import type { EmailRequest, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import type { EmailRequestData } from "../../domain/email-request/contracts";
import type {
    CreateEmailRequestData,
    EmailRequestFilters,
    EmailRequestReadAuthorization,
    EmailRequestWithUser,
    PaginatedEmailRequestsResult,
} from "../../application/email-request/types";

type EmailRequestPersistenceClient = Pick<
    Prisma.TransactionClient,
    "emailRequest" | "emailRequestIdempotency"
>;

interface StoredEmailRequestReplay {
    requestHash: string;
    emailRequest: EmailRequest;
}

export interface PersistedEmailRequestResult extends StoredEmailRequestReplay {
    replayed: boolean;
}

class EmailRequestIdempotencyRaceError extends Error {}

async function findEmailRequestReplay(
    client: EmailRequestPersistenceClient,
    userId: number,
    idempotencyKey: string,
): Promise<StoredEmailRequestReplay | null> {
    const existing = await client.emailRequestIdempotency.findUnique({
        where: {
            userId_idempotencyKey: { userId, idempotencyKey },
        },
        include: { emailRequest: true },
    });
    if (!existing) return null;

    return {
        requestHash: existing.requestHash,
        emailRequest: existing.emailRequest,
    };
}

function buildEmailRequestOutboxPayload(
    data: CreateEmailRequestData,
    emailRequest: EmailRequest,
): EmailRequestData {
    return {
        thaiName: data.thaiName,
        englishName: data.englishName,
        phone: data.phone,
        nickname: data.nickname ?? "",
        position: data.position,
        department: data.department,
        replyEmail: data.replyEmail,
        needsDocumentSystem: data.needsDocumentSystem,
        sharedDriveAccess: data.sharedDriveAccess,
        requestedAt: emailRequest.createdAt.toISOString(),
    };
}

/** Persist the request, requester-scoped idempotency record, and outbox event atomically. */
export async function persistEmailRequest(
    data: CreateEmailRequestData,
    input: {
        readonly userId: number;
        readonly idempotencyKey: string;
        readonly requestHash: string;
    },
): Promise<PersistedEmailRequestResult> {
    try {
        return await runSerializableTransaction(async (tx) => {
            const replay = await findEmailRequestReplay(
                tx,
                input.userId,
                input.idempotencyKey,
            );
            if (replay) return { ...replay, replayed: true };

            const emailRequest = await tx.emailRequest.create({
                data: {
                    thaiName: data.thaiName,
                    englishName: data.englishName,
                    phone: data.phone,
                    nickname: data.nickname ?? "",
                    position: data.position,
                    department: data.department,
                    replyEmail: data.replyEmail,
                    needsDocumentSystem: data.needsDocumentSystem,
                    sharedDriveAccess: data.sharedDriveAccess,
                    requestedBy: input.userId,
                },
            });

            try {
                await tx.emailRequestIdempotency.create({
                    data: {
                        userId: input.userId,
                        idempotencyKey: input.idempotencyKey,
                        requestHash: input.requestHash,
                        emailRequestId: emailRequest.id,
                    },
                });
            } catch (error) {
                if (hasPrismaErrorCode(error, "P2002")) {
                    throw new EmailRequestIdempotencyRaceError();
                }
                throw error;
            }

            const notificationData = buildEmailRequestOutboxPayload(data, emailRequest);
            await tx.notificationOutbox.create({
                data: {
                    type: "EMAIL_REQUEST",
                    eventKey: `email-request:${emailRequest.id}:created`,
                    payload: JSON.stringify(notificationData),
                },
            });

            return {
                requestHash: input.requestHash,
                emailRequest,
                replayed: false,
            };
        });
    } catch (error) {
        if (!(error instanceof EmailRequestIdempotencyRaceError)) throw error;

        const replay = await findEmailRequestReplay(
            prisma,
            input.userId,
            input.idempotencyKey,
        );
        if (!replay) throw error;

        return { ...replay, replayed: true };
    }
}

/** Query breadth comes from resolved OWN/ALL authorization and is enforced by MySQL. */
export const getEmailRequests = cache(
    async (
        filters: EmailRequestFilters,
        authorization: EmailRequestReadAuthorization,
    ): Promise<PaginatedEmailRequestsResult> => {
        const page = Math.max(1, filters.page);
        const limit = Math.min(Math.max(1, filters.limit), 100);
        const skip = (page - 1) * limit;

        const where: Prisma.EmailRequestWhereInput = authorization.scopes.includes("ALL")
            ? {}
            : authorization.scopes.includes("OWN")
                ? { requestedBy: authorization.userId }
                : (() => {
                    throw new Error("Email Request read authorization has no supported scope");
                })();

        const [total, emailRequests] = await Promise.all([
            prisma.emailRequest.count({ where }),
            prisma.emailRequest.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        return {
            emailRequests: emailRequests as EmailRequestWithUser[],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },
);
