import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    getAuthorizedLeaveAttachment,
    leaveAttachmentIdParamSchema,
    readLeaveAttachment,
} from "@/modules/leave";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound, serverError } from "@/lib/ssot/http";

interface LeaveAttachmentRouteContext {
    params: Promise<{ id: string }>;
}

function getErrorCode(error: unknown): string | undefined {
    if (
        typeof error !== "object"
        || error === null
        || !("code" in error)
        || typeof error.code !== "string"
    ) {
        return undefined;
    }
    return error.code;
}

export async function GET(
    _request: Request,
    { params }: LeaveAttachmentRouteContext,
): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    const parsed = leaveAttachmentIdParamSchema.safeParse((await params).id);
    if (!parsed.success) return notFound();

    try {
        const attachment = await getAuthorizedLeaveAttachment(
            parsed.data,
            auth.employeeId,
        );
        if (!attachment) return notFound();
        if (attachment.contentType !== "image/webp") return serverError();

        try {
            const file = await readLeaveAttachment(attachment.storageKey);
            return new NextResponse(new Uint8Array(file), {
                status: 200,
                headers: {
                    "Content-Type": "image/webp",
                    "Content-Disposition": "inline",
                    "Cache-Control": "private, no-store",
                    "X-Content-Type-Options": "nosniff",
                },
            });
        } catch (error) {
            if (getErrorCode(error) === "ENOENT") return notFound();
            throw error;
        }
    } catch (error) {
        console.error("Read LIFF leave attachment failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
            errorCode: getErrorCode(error),
        });
        return serverError();
    }
}
