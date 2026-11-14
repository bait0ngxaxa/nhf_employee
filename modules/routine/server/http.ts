import type { NextRequest, NextResponse } from "next/server";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import {
    contentLengthExceedsLimit,
} from "@/lib/server/request-body";
import { isFeatureEnabled, FEATURE_KEYS } from "@/lib/ssot/features";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { jsonError, notFound } from "@/lib/ssot/http";
import { ROUTINE_API_MESSAGES } from "@/lib/ssot/messages";
import { ROUTINE_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";
import { RoutineServiceError } from "../application/errors";

export { ROUTINE_MAX_REQUEST_BYTES };

export function routineFeatureGuard(
    surface: "web" | "liff" = "web",
): NextResponse | null {
    if (isFeatureEnabled(FEATURE_KEYS.routine)) return null;
    return surface === "liff"
        ? jsonError(ROUTINE_API_MESSAGES.liffFeatureDisabled, 404)
        : notFound();
}

export function routineRequestSizeGuard(
    request: NextRequest,
): NextResponse | null {
    if (contentLengthExceedsLimit(request, ROUTINE_MAX_REQUEST_BYTES)) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
    return null;
}

export async function readRoutineJsonBody(
    request: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
    return readRouteJsonBody(request, { maxBytes: ROUTINE_MAX_REQUEST_BYTES });
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
