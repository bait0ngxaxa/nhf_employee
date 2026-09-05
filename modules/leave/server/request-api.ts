import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import {
    createLeaveRequest,
    LeaveRequestError,
    LeaveRequestIdempotencyConflictError,
    type CreatedLeaveRequest,
} from "@/modules/leave/application/requests/create-request";
import {
    LEAVE_REQUEST_IDEMPOTENCY_CONFLICT_CODE,
} from "@/modules/leave/application/requests/idempotency";
import {
    LeaveRequestInputError,
    parseLeaveRequestInput,
} from "@/modules/leave/application/requests/request-input";
import {
    toLeaveAttachmentSummary,
    type LeaveAttachmentUrlBuilder,
} from "@/modules/leave/application/queries/attachment-summary";
import { toLeaveRequestDays } from "@/modules/leave/domain/half-days";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    deleteLeaveAttachment,
    LeaveAttachmentValidationError,
    saveLeaveAttachments,
    type StoredLeaveAttachment,
} from "@/modules/leave/infrastructure/attachments/storage";

export interface LeaveRequestActor {
    userId: number;
    employeeId: number;
    userEmail: string;
}

export type LeaveRequestResponseSerializer = (
    request: CreatedLeaveRequest,
) => object;

interface LeaveRequestApiDependencies {
    saveLeaveAttachments: typeof saveLeaveAttachments;
    deleteLeaveAttachment: typeof deleteLeaveAttachment;
}

const defaultDependencies: LeaveRequestApiDependencies = {
    saveLeaveAttachments,
    deleteLeaveAttachment,
};

async function cleanupAttachments(
    attachments: readonly StoredLeaveAttachment[],
    deleteAttachment: LeaveRequestApiDependencies["deleteLeaveAttachment"],
): Promise<void> {
    const results = await Promise.allSettled(
        attachments.map(({ storageKey }) => deleteAttachment(storageKey)),
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
    scheduleOutbox?: () => void,
    dependencies: LeaveRequestApiDependencies = defaultDependencies,
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
        storedAttachments = await dependencies.saveLeaveAttachments({
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
            await cleanupAttachments(
                storedAttachments,
                dependencies.deleteLeaveAttachment,
            );
        } else if (scheduleOutbox) {
            scheduleOutbox();
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
            await cleanupAttachments(
                storedAttachments,
                dependencies.deleteLeaveAttachment,
            );
        }
        return createErrorResponse(error);
    }
}

export { createErrorResponse as createLeaveRequestErrorResponse };
