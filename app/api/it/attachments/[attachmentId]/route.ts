import { NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { forbidden, notFound, operationFailed } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    getITTicketAttachmentForDownload,
    ITCapabilityDeniedError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
    readITTicketAttachment,
} from "@/modules/it";

interface AttachmentRouteContext {
    readonly params: Promise<{ readonly attachmentId: string }>;
}

function getErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
        ? error.code
        : undefined;
}

function logAttachmentReadError(error: unknown): void {
    const rawErrorType = error instanceof Error ? error.name : "UnknownError";
    const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(rawErrorType)
        ? rawErrorType
        : "UnknownError";
    console.error("IT attachment read failed", {
        errorType,
        errorCode: getErrorCode(error),
    });
}

export async function GET(
    _request: Request,
    { params }: AttachmentRouteContext,
): Promise<NextResponse> {
    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const { attachmentId } = await params;
        const attachment = await getITTicketAttachmentForDownload(
            await buildCurrentITAuthorizationContext(auth.user),
            attachmentId,
        );
        if (attachment.contentType !== "image/webp") {
            console.error("IT attachment metadata contract mismatch", {
                errorType: "InvalidContentType",
            });
            return operationFailed(500);
        }

        try {
            const bytes = await readITTicketAttachment(attachment.storageKey, attachment.ticketId);
            return new NextResponse(new Uint8Array(bytes), {
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
            logAttachmentReadError(error);
            return operationFailed(500);
        }
    } catch (error) {
        if (error instanceof ITCapabilityDeniedError || error instanceof ITWorkforceDeniedError) {
            return forbidden({ success: false });
        }
        if (error instanceof ITTicketNotFoundError) return notFound({ success: false });
        logAttachmentReadError(error);
        return operationFailed(500);
    }
}
