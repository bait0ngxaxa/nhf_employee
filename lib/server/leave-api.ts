import type { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/ssot/http";

export const LEAVE_JSON_MUTATION_MAX_BYTES = 32 * 1024;

export function enforceLeaveJsonBodySize(
    request: NextRequest,
): NextResponse | null {
    const rawContentLength = request.headers.get("content-length");
    if (!rawContentLength) return null;

    const contentLength = Number(rawContentLength);
    if (
        Number.isSafeInteger(contentLength)
        && contentLength > LEAVE_JSON_MUTATION_MAX_BYTES
    ) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
    return null;
}
