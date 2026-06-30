import { type NextRequest, NextResponse, after } from "next/server";

import { requireAdminSession, requireApiSession } from "@/lib/auth/api";
import { createAuditLog } from "@/lib/server/audit";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    emailRequestService,
    type EmailRequestFilters,
} from "@/lib/services/email-request";
import { forbidden, operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { emailRequestSchema } from "@/lib/validations/email-request";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const body = await req.json();
        const validation = emailRequestSchema.safeParse(body);

        if (!validation.success) {
            const errorMessages = validation.error.issues.map((issue) => issue.message).join(", ");
            return NextResponse.json(
                { success: false, error: errorMessages },
                { status: 400 },
            );
        }

        const result = await emailRequestService.createEmailRequest(validation.data, auth.user);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.status || 500 },
            );
        }

        if (!result.emailRequest) {
            throw new Error("Created email request data is missing");
        }

        await createAuditLog({
            action: "EMAIL_REQUEST",
            entityType: "EmailRequest",
            entityId: result.emailRequest.id,
            userId: auth.user.id,
            userEmail: auth.user.email,
            details: {
                after: {
                    thaiName: validation.data.thaiName,
                    englishName: validation.data.englishName,
                    position: validation.data.position,
                    department: validation.data.department,
                    needsDocumentSystem: validation.data.needsDocumentSystem,
                    sharedDriveAccess: validation.data.sharedDriveAccess,
                },
            },
        });

        after(async () => {
            processOutbox().catch((err) =>
                console.error("Outbox processor failed:", err),
            );
        });

        return NextResponse.json({
            success: true,
            message: COMMON_API_MESSAGES.operationCompleted,
            data: {
                id: result.emailRequest.id,
                thaiName: validation.data.thaiName,
                englishName: validation.data.englishName,
                nickname: validation.data.nickname,
                position: validation.data.position,
                department: validation.data.department,
                needsDocumentSystem: validation.data.needsDocumentSystem,
                sharedDriveAccess: validation.data.sharedDriveAccess,
                requestedAt: result.emailRequest.createdAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("Error processing email request:", error);
        return operationFailed(500, { success: false });
    }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(req.url);
        const filters: EmailRequestFilters = {
            page: parseInt(searchParams.get("page") || "1", 10),
            limit: parseInt(searchParams.get("limit") || "10", 10),
        };

        const result = await emailRequestService.getEmailRequests(filters, auth.user);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("Error fetching email requests:", error);
        return operationFailed(500, { success: false });
    }
}
