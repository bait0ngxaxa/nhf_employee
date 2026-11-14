import type { NextRequest, NextResponse } from "next/server";

import {
    contentLengthExceedsLimit,
} from "@/lib/server/request-body";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
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
    return readRouteJsonBody(request, { maxBytes: LEAVE_JSON_MUTATION_MAX_BYTES });
}
