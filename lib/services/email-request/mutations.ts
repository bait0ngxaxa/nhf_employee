import { prisma } from "@/lib/prisma";
import { lineNotificationService } from "@/lib/line";
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
    // Save to database
    const emailRequest = await prisma.emailRequest.create({
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

    // Send LINE notification (non-blocking)
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

    lineNotificationService
        .sendEmailRequestNotification(notificationData)
        .catch((error) => {
            console.error("LINE notification failed:", error);
        });

    return {
        success: true,
        emailRequest,
    };
}
