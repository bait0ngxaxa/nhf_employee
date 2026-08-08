import { type NextRequest, NextResponse, after } from "next/server";

import { requireAdminSession, requireApiSession } from "@/lib/auth/api";
import { createAuditLog } from "@/lib/server/audit";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    emailRequestService,
    EmailRequestIdempotencyConflictError,
    type EmailRequestFilters,
} from "@/lib/services/email-request";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    emailRequestFiltersSchema,
    emailRequestSchema,
} from "@/lib/validations/email-request";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
            req.headers.get("Idempotency-Key"),
        );
        if (!parsedIdempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400);
        }

        const body = await req.json();
        const validation = emailRequestSchema.safeParse(body);

        if (!validation.success) {
            const errorMessages = validation.error.issues.map((issue) => issue.message).join(", ");
            return NextResponse.json(
                { success: false, error: errorMessages },
                { status: 400 },
            );
        }

        const result = await emailRequestService.createEmailRequest(
            validation.data,
            auth.user,
            { idempotencyKey: parsedIdempotencyKey.data },
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.status || 500 },
            );
        }

        if (!result.emailRequest) {
            throw new Error("Created email request data is missing");
        }

        if (!result.replayed) {
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
        }

        return NextResponse.json(
            {
                success: true,
                message: COMMON_API_MESSAGES.operationCompleted,
                data: {
                    id: result.emailRequest.id,
                    thaiName: result.emailRequest.thaiName,
                    englishName: result.emailRequest.englishName,
                    nickname: result.emailRequest.nickname,
                    position: result.emailRequest.position,
                    department: result.emailRequest.department,
                    needsDocumentSystem: result.emailRequest.needsDocumentSystem,
                    sharedDriveAccess: result.emailRequest.sharedDriveAccess,
                    requestedAt: result.emailRequest.createdAt.toISOString(),
                },
            },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        if (error instanceof EmailRequestIdempotencyConflictError) {
            return jsonError(error.message, 409, { success: false });
        }
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
        const parsedFilters = emailRequestFiltersSchema.safeParse({
            page: searchParams.get("page") ?? "1",
            limit: searchParams.get("limit") ?? "10",
        });
        if (!parsedFilters.success) {
            return operationFailed(400, {
                success: false,
                details: parsedFilters.error.flatten().fieldErrors,
            });
        }
        const filters: EmailRequestFilters = parsedFilters.data;

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
