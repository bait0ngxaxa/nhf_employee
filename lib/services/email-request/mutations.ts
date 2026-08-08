import type { EmailRequest, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { type EmailRequestData } from "@/types/api";
import {
    assertMatchingEmailRequestHash,
    createEmailRequestHash,
} from "./idempotency";
import type {
    CreateEmailRequestData,
    CreateEmailRequestOptions,
    CreateEmailRequestResult,
    UserContext,
} from "./types";

type EmailRequestIdempotencyClient = Pick<
    Prisma.TransactionClient,
    "emailRequestIdempotency"
>;

class EmailRequestIdempotencyRaceError extends Error {}

async function findReplay(
    client: EmailRequestIdempotencyClient,
    userId: number,
    idempotencyKey: string,
    requestHash: string,
): Promise<EmailRequest | null> {
    const existing = await client.emailRequestIdempotency.findUnique({
        where: {
            userId_idempotencyKey: { userId, idempotencyKey },
        },
        include: { emailRequest: true },
    });
    if (!existing) {
        return null;
    }

    assertMatchingEmailRequestHash(existing, requestHash);
    return existing.emailRequest;
}

/**
 * Create a new email request and enqueue its LINE notification atomically.
 */
export async function createEmailRequest(
    data: CreateEmailRequestData,
    user: UserContext,
    options: CreateEmailRequestOptions,
): Promise<CreateEmailRequestResult> {
    const requestHash = createEmailRequestHash(data);

    try {
        return await runSerializableTransaction(async (tx) => {
            const replay = await findReplay(
                tx,
                user.id,
                options.idempotencyKey,
                requestHash,
            );
            if (replay) {
                return {
                    success: true,
                    emailRequest: replay,
                    replayed: true,
                };
            }

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
                    requestedBy: user.id,
                },
            });

            try {
                await tx.emailRequestIdempotency.create({
                    data: {
                        userId: user.id,
                        idempotencyKey: options.idempotencyKey,
                        requestHash,
                        emailRequestId: emailRequest.id,
                    },
                });
            } catch (error) {
                if (hasPrismaErrorCode(error, "P2002")) {
                    throw new EmailRequestIdempotencyRaceError();
                }
                throw error;
            }

            const notificationData: EmailRequestData = {
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
            await tx.notificationOutbox.create({
                data: {
                    type: "EMAIL_REQUEST",
                    eventKey: `email-request:${emailRequest.id}:created`,
                    payload: JSON.stringify(notificationData),
                },
            });

            return {
                success: true,
                emailRequest,
                replayed: false,
            };
        });
    } catch (error) {
        if (!(error instanceof EmailRequestIdempotencyRaceError)) {
            throw error;
        }

        const replay = await findReplay(
            prisma,
            user.id,
            options.idempotencyKey,
            requestHash,
        );
        if (!replay) {
            throw error;
        }

        return {
            success: true,
            emailRequest: replay,
            replayed: true,
        };
    }
}
