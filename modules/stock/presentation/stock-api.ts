import type { NextRequest, NextResponse } from "next/server";

import {
    contentLengthExceedsLimit,
} from "@/lib/server/request-body";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { jsonError } from "@/lib/ssot/http";
import { STOCK_JSON_MUTATION_MAX_BYTES } from "@/lib/ssot/request-limits";

export { STOCK_JSON_MUTATION_MAX_BYTES };

export function enforceStockJsonBodySize(
    request: NextRequest,
): NextResponse | null {
    if (contentLengthExceedsLimit(request, STOCK_JSON_MUTATION_MAX_BYTES)) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
    return null;
}

export async function readStockJsonBody(
    request: NextRequest,
): Promise<
    | { ok: true; body: unknown }
    | { ok: false; response: NextResponse }
> {
    return readRouteJsonBody(request, { maxBytes: STOCK_JSON_MUTATION_MAX_BYTES });
}
