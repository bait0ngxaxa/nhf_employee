import { randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";

import {
    createLeaveRequest,
    LeaveRequestError,
    LeaveRequestIdempotencyConflictError,
    type CreatedLeaveRequest,
} from "@/lib/services/leave/create-request";
import {
    LEAVE_REQUEST_IDEMPOTENCY_CONFLICT_CODE,
} from "@/lib/services/leave/idempotency";
import {
    LeaveRequestInputError,
    parseLeaveRequestInput,
} from "@/lib/services/leave/request-input";
import {
    toLeaveAttachmentSummary,
    type LeaveAttachmentUrlBuilder,
} from "@/lib/services/leave/attachment-summary";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";
import { processOutbox } from "@/lib/services/outbox/processor";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    deleteLeaveAttachment,
    LeaveAttachmentValidationError,
    saveLeaveAttachments,
    type StoredLeaveAttachment,
} from "@/lib/uploads/leave";

export interface LeaveRequestActor {
    userId: number;
    employeeId: number;
    userEmail: string;
}

export type LeaveRequestResponseSerializer = (
    request: CreatedLeaveRequest,
) => object;

async function cleanupAttachments(
    attachments: readonly StoredLeaveAttachment[],
): Promise<void> {
    const results = await Promise.allSettled(
        attachments.map(({ storageKey }) => deleteLeaveAttachment(storageKey)),
    );
    const failedCleanupCount = results.filter(
        (result) => result.status === "rejected",
    ).length;
    if (failedCleanupCount > 0) {
        console.error("ลบไฟล์หลักฐานของคำขอลาที่ไม่สำเร็จไม่ครบ", {
            failedCleanupCount,
        });
    }
}

function createErrorResponse(error: unknown): NextResponse {
    if (error instanceof LeaveRequestInputError) {
        return jsonError(error.message, error.statusCode, error.details);
    }
    if (error instanceof LeaveAttachmentValidationError) {
        return jsonError(error.message, 400);
    }
    if (error instanceof LeaveRequestIdempotencyConflictError) {
        return jsonError(error.message, 409, {
            code: LEAVE_REQUEST_IDEMPOTENCY_CONFLICT_CODE,
        });
    }
    if (error instanceof LeaveRequestError) {
        return jsonError(error.message, error.statusCode);
    }

    console.error("สร้างคำขอลาไม่สำเร็จ", {
        errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError(COMMON_API_MESSAGES.failedToSubmitLeaveRequest, 500);
}

function createResponseData(
    result: CreatedLeaveRequest,
    buildAttachmentUrl?: LeaveAttachmentUrlBuilder,
): Record<string, unknown> {
    const converted = toLeaveRequestDays(result);
    return {
        ...converted,
        attachments: (result.attachments ?? []).map((attachment) =>
            toLeaveAttachmentSummary(attachment, buildAttachmentUrl),
        ),
    };
}

export async function handleLeaveRequestSubmission(
    request: NextRequest,
    actor: LeaveRequestActor,
    buildAttachmentUrl?: LeaveAttachmentUrlBuilder,
    serializeResponse?: LeaveRequestResponseSerializer,
): Promise<NextResponse> {
    let storedAttachments: StoredLeaveAttachment[] = [];
    let transactionCommitted = false;
    try {
        const input = await parseLeaveRequestInput(request);
        const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!parsedIdempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400);
        }

        const leaveRequestId = randomUUID();
        storedAttachments = await saveLeaveAttachments({
            leaveRequestId,
            files: input.attachments,
        });
        const result = await createLeaveRequest({
            id: leaveRequestId,
            userId: actor.userId,
            userEmail: actor.userEmail,
            employeeId: actor.employeeId,
            idempotencyKey: parsedIdempotencyKey.data,
            payload: input.payload,
            attachments: storedAttachments,
        });
        transactionCommitted = true;

        if (result.replayed) {
            await cleanupAttachments(storedAttachments);
        } else {
            after(() => {
                processOutbox().catch((error: unknown) =>
                    console.error("ประมวลผล outbox หลังสร้างคำขอลาไม่สำเร็จ", {
                        errorType: error instanceof Error ? error.name : "UnknownError",
                    }),
                );
            });
        }

        return NextResponse.json(
            {
                success: true,
                data: serializeResponse
                    ? serializeResponse(result.request)
                    : createResponseData(result.request, buildAttachmentUrl),
            },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        if (!transactionCommitted && storedAttachments.length > 0) {
            await cleanupAttachments(storedAttachments);
        }
        return createErrorResponse(error);
    }
}

export { createErrorResponse as createLeaveRequestErrorResponse };
