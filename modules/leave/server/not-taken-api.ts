import { NextResponse, type NextRequest } from "next/server";

import {
    confirmLeaveNotTaken,
    LeaveNotTakenError,
    requestLeaveNotTaken,
    type LeaveNotTakenActor,
} from "../application/not-taken";
import { toLeaveRequestDays } from "../domain/half-days";
import {
    leaveNotTakenConfirmSchema,
    leaveNotTakenRequestSchema,
} from "../schemas/leave";
import type { LiffLeaveMutationResponse } from "./liff-serialization";
import { readLeaveJsonBody } from "./http";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export type LeaveNotTakenApiActor = LeaveNotTakenActor;

type LeaveNotTakenResponseSerializer = (
    request: { id: string; status: LiffLeaveMutationResponse["status"] },
) => LiffLeaveMutationResponse;

export async function handleLeaveNotTakenRequest(
    req: NextRequest,
    auth: LeaveNotTakenApiActor,
    serializeResponse?: LeaveNotTakenResponseSerializer,
    scheduleOutbox?: () => void,
): Promise<NextResponse> {
    try {
        const body = await readLeaveJsonBody(req);
        if (!body.ok) return body.response;
        const parsed = leaveNotTakenRequestSchema.safeParse(body.body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await requestLeaveNotTaken({
            actor: auth,
            leaveId: parsed.data.leaveId,
            note: parsed.data.note,
        });
        scheduleOutbox?.();

        return NextResponse.json({
            success: true,
            data: serializeResponse
                ? serializeResponse(result.request)
                : toLeaveRequestDays(result.request),
        });
    } catch (error) {
        console.error("Leave not-taken request error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}

export async function handleLeaveNotTakenConfirmation(
    req: NextRequest,
    auth: LeaveNotTakenApiActor,
    options: {
        allowAdminOverride: boolean;
        serializeResponse?: LeaveNotTakenResponseSerializer;
        scheduleOutbox?: () => void;
    },
): Promise<NextResponse> {
    try {
        const body = await readLeaveJsonBody(req);
        if (!body.ok) return body.response;
        const parsed = leaveNotTakenConfirmSchema.safeParse(body.body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await confirmLeaveNotTaken({
            actor: auth,
            leaveId: parsed.data.leaveId,
            reason: parsed.data.reason,
            allowAdminOverride: options.allowAdminOverride,
        });
        options.scheduleOutbox?.();

        return NextResponse.json({
            success: true,
            data: options.serializeResponse
                ? options.serializeResponse(result.request)
                : toLeaveRequestDays(result.request),
        });
    } catch (error) {
        console.error("Leave not-taken confirm error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}
