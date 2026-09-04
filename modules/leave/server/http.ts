import type { NextRequest, NextResponse } from "next/server";

import {
    contentLengthExceedsLimit,
    readBoundedJsonBody,
} from "@/lib/server/request-body";
import { jsonError } from "@/lib/ssot/http";
import { LEAVE_JSON_MUTATION_MAX_BYTES } from "@/lib/ssot/request-limits";

export { LEAVE_JSON_MUTATION_MAX_BYTES };

export function enforceLeaveJsonBodySize(
    request: NextRequest,
): NextResponse | null {
    if (contentLengthExceedsLimit(request, LEAVE_JSON_MUTATION_MAX_BYTES)) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
    return null;
}

export async function readLeaveJsonBody(
    request: NextRequest,
): Promise<
    | { ok: true; body: unknown }
    | { ok: false; response: NextResponse }
> {
    const result = await readBoundedJsonBody(
        request,
        LEAVE_JSON_MUTATION_MAX_BYTES,
    );
    if (!result.ok) {
        return {
            ok: false,
            response: jsonError(
                result.reason === "TOO_LARGE"
                    ? "คำขอมีขนาดใหญ่เกินไป"
                    : "ข้อมูลไม่ถูกต้อง",
                result.reason === "TOO_LARGE" ? 413 : 400,
            ),
        };
    }
    return { ok: true, body: result.value };
}
