import { randomUUID } from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
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
    assertLeaveRequestBodySize,
    parseLeaveRequestInput,
} from "@/lib/services/leave/request-input";
import { toLeaveAttachmentSummary } from "@/lib/services/leave/attachment-summary";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";
import { processOutbox } from "@/lib/services/outbox/processor";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import {
    deleteLeaveAttachment,
    LeaveAttachmentValidationError,
    saveLeaveAttachments,
    type StoredLeaveAttachment,
} from "@/lib/uploads/leave";

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

function createResponseData(result: CreatedLeaveRequest): Record<string, unknown> {
    const converted = toLeaveRequestDays(result);
    return {
        ...converted,
        attachments: (result.attachments ?? []).map(toLeaveAttachmentSummary),
    };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        return notFound();
    }

    const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
        request,
        "leave-request-create",
    );
    if (preAuthRateLimitResponse) {
        return preAuthRateLimitResponse;
    }

    // Reject oversized bodies before authentication; the parser repeats this
    // guard so it remains safe when used by another entry point.
    try {
        assertLeaveRequestBodySize(request);
    } catch (error) {
        return createErrorResponse(error);
    }

    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) {
        return auth.response;
    }
    const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
        "leave-request-create",
        auth.user.id,
    );
    if (principalRateLimitResponse) {
        return principalRateLimitResponse;
    }

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
            userId: auth.user.id,
            userEmail: auth.user.email,
            employeeId: auth.employeeId,
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
            { success: true, data: createResponseData(result.request) },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        if (!transactionCommitted && storedAttachments.length > 0) {
            await cleanupAttachments(storedAttachments);
        }
        return createErrorResponse(error);
    }
}
