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
} from "./types";

export async function createEmailRequest(
    data: CreateEmailRequestData,
    user: UserContext,
    options: CreateEmailRequestOptions,
): Promise<CreateEmailRequestResult> {
    const requestHash = createEmailRequestHash(data);
    const persisted = await persistEmailRequest(data, {
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
