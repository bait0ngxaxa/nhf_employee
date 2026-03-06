import { prisma } from "@/lib/prisma";
import { OUTBOX_NOTIFICATION_TYPES } from "@/lib/services/outbox/types";
import { type EmailRequestData } from "@/types/api";
import type {
    CreateEmailRequestData,
    CreateEmailRequestResult,
    UserContext,
} from "./types";

/**
 * Create a new email request and send LINE notification
 */
export async function createEmailRequest(
    data: CreateEmailRequestData,
    user: UserContext,
): Promise<CreateEmailRequestResult> {
    const notificationData: EmailRequestData = {
        thaiName: data.thaiName,
        englishName: data.englishName,
        phone: data.phone,
        nickname: data.nickname ?? "",
        position: data.position,
        department: data.department,
        replyEmail: data.replyEmail,
        requestedAt: new Date().toISOString(),
    };

    // Use transaction to ensure outbox entry and email request are created together
    const emailRequest = await prisma.$transaction(async (tx) => {
        const newRecord = await tx.emailRequest.create({
            data: {
                thaiName: data.thaiName,
                englishName: data.englishName,
                phone: data.phone,
                nickname: data.nickname ?? "",
                position: data.position,
                department: data.department,
                replyEmail: data.replyEmail,
                requestedBy: user.id,
            },
        });

        await tx.notificationOutbox.create({
            data: {
                type: OUTBOX_NOTIFICATION_TYPES[2],
                payload: JSON.stringify(notificationData),
            },
        });

        return newRecord;
    });

    return {
        success: true,
        emailRequest,
    };
}

