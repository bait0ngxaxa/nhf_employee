import { NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import {
    getAuthorizedLeaveAttachmentForViewer,
    leaveAttachmentIdParamSchema,
    readLeaveAttachment,
} from "@/modules/leave";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound, serverError } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";

interface AttachmentRouteContext {
    params: Promise<{ attachmentId: string }>;
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

function logReadError(error: unknown): void {
    console.error("อ่านไฟล์หลักฐานการลาไม่สำเร็จ", {
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorCode: getErrorCode(error),
    });
}

export async function GET(
    _request: Request,
    { params }: AttachmentRouteContext,
): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        return notFound();
    }

    const auth = await requireActiveWorkforceOrAdminSession();
    if (!auth.ok) {
        return auth.response;
    }

    const { attachmentId: rawAttachmentId } = await params;
    const parsedAttachmentId =
        leaveAttachmentIdParamSchema.safeParse(rawAttachmentId);
    if (!parsedAttachmentId.success) {
        return notFound();
    }

    try {
        const employeeId = "employeeId" in auth ? auth.employeeId : undefined;
        const attachment = await getAuthorizedLeaveAttachmentForViewer(
            parsedAttachmentId.data,
            {
                employeeId,
                isAdmin: isAdminRole(auth.user.role),
            },
        );

        if (!attachment) {
            return notFound();
        }

        if (attachment.contentType !== "image/webp") {
            console.error("ชนิดไฟล์หลักฐานการลาในฐานข้อมูลไม่ถูกต้อง");
            return serverError();
        }

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
            if (getErrorCode(error) === "ENOENT") {
                return notFound();
            }

            logReadError(error);
            return serverError();
        }
    } catch (error) {
        logReadError(error);
        return serverError();
    }
}
