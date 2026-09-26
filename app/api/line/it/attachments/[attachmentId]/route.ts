import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/modules/line";
import {
    buildITAuthorizationContext,
    getITTicketAttachmentForDownload,
    ITCapabilityDeniedError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
    logITTicketRouteFailure,
    readITTicketAttachment,
} from "@/modules/it";
import { forbidden, notFound, operationFailed } from "@/lib/ssot/http";

interface RouteContext {
    readonly params: Promise<{ readonly attachmentId: string }>;
}

function getErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
        ? error.code
        : undefined;
}

export async function GET(
    _request: Request,
    { params }: RouteContext,
): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const attachment = await getITTicketAttachmentForDownload(
            buildITAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
            (await params).attachmentId,
        );
        if (attachment.contentType !== "image/webp") {
            logITTicketRouteFailure("LIFF IT attachment metadata contract mismatch", {
                name: "InvalidContentType",
            });
            return operationFailed(500);
        }

        try {
            const bytes = await readITTicketAttachment(
                attachment.storageKey,
                attachment.ticketId,
            );
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
            throw error;
        }
    } catch (error) {
        if (error instanceof ITCapabilityDeniedError || error instanceof ITWorkforceDeniedError) {
            return forbidden({ success: false });
        }
        if (error instanceof ITTicketNotFoundError) return notFound({ success: false });
        logITTicketRouteFailure("LIFF IT attachment read failed", error);
        return operationFailed(500);
    }
}
