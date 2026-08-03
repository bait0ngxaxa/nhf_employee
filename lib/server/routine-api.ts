import type { NextRequest, NextResponse } from "next/server";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { isFeatureEnabled, FEATURE_KEYS } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { ROUTINE_API_MESSAGES } from "@/lib/ssot/messages";
import { RoutineServiceError } from "@/lib/services/routine";

export const ROUTINE_MAX_REQUEST_BYTES = 64 * 1024;

export function routineFeatureGuard(): NextResponse | null {
    return isFeatureEnabled(FEATURE_KEYS.routine) ? null : notFound();
}

export function routineRequestSizeGuard(
    request: NextRequest,
): NextResponse | null {
    const contentLength = Number(request.headers.get("content-length"));
    if (
        Number.isFinite(contentLength)
        && contentLength > ROUTINE_MAX_REQUEST_BYTES
    ) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
    return null;
}

export async function readRoutineJsonBody(
    request: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
    try {
        const body: unknown = await request.json();
        return { ok: true, body };
    } catch {
        return {
            ok: false,
            response: jsonError(ROUTINE_API_MESSAGES.invalidInput, 400),
        };
    }
}

export function routineErrorResponse(
    error: unknown,
    operation: string,
): NextResponse {
    if (error instanceof RoutineServiceError) {
        return jsonError(error.message, error.statusCode);
    }
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError("ข้อมูล NHF Routine ซ้ำกับรายการเดิม", 409);
    }

    console.error(operation, {
        errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError(ROUTINE_API_MESSAGES.internalServerError, 500);
}
