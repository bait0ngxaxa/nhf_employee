import type { NextRequest, NextResponse } from "next/server";

import {
    contentLengthExceedsLimit,
    readBoundedJsonBody,
} from "@/lib/server/request-body";
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
    const result = await readBoundedJsonBody(
        request,
        STOCK_JSON_MUTATION_MAX_BYTES,
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
