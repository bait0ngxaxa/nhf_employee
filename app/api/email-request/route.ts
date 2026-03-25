import { type NextRequest, NextResponse, after } from "next/server";

import { createAuditLog } from "@/lib/audit";
import { buildUserContext } from "@/lib/context";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    emailRequestService,
    type EmailRequestFilters,
} from "@/lib/services/email-request";
import { getApiAuthSession } from "@/lib/server-auth";
import { forbidden, operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { emailRequestSchema } from "@/lib/validations/email-request";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user) {
            return unauthorized({ success: false });
        }

        if (!isAdminRole(session.user.role)) {
            return forbidden({ success: false });
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

        const user = buildUserContext(session);
        const result = await emailRequestService.createEmailRequest(validation.data, user);

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
            userId: user.id,
            userEmail: user.email,
            details: {
                after: {
                    thaiName: validation.data.thaiName,
                    englishName: validation.data.englishName,
                    position: validation.data.position,
                    department: validation.data.department,
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
        const session = await getApiAuthSession();
        if (!session?.user) {
            return unauthorized({ success: false });
        }

        const { searchParams } = new URL(req.url);
        const filters: EmailRequestFilters = {
            page: parseInt(searchParams.get("page") || "1", 10),
            limit: parseInt(searchParams.get("limit") || "10", 10),
        };

        const user = buildUserContext(session);
        const result = await emailRequestService.getEmailRequests(filters, user);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("Error fetching email requests:", error);
        return operationFailed(500, { success: false });
    }
}
