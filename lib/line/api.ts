import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { badRequest, jsonError } from "@/lib/ssot/http";

export const LINE_AUTH_MAX_REQUEST_BYTES = 16 * 1024;

const lineIdTokenRequestSchema = z.object({
    idToken: z.string().trim().min(1).max(4096),
}).strict();

export function lineRequestSizeGuard(
    request: NextRequest,
): NextResponse | null {
    const contentLength = Number(request.headers.get("content-length"));
    if (
        Number.isFinite(contentLength)
        && contentLength > LINE_AUTH_MAX_REQUEST_BYTES
    ) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
    return null;
}

export async function readLineIdToken(
    request: NextRequest,
): Promise<
    | { ok: true; idToken: string }
    | { ok: false; response: NextResponse }
> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return { ok: false, response: badRequest() };
    }

    const parsed = lineIdTokenRequestSchema.safeParse(body);
    if (!parsed.success) {
        return { ok: false, response: badRequest() };
    }

    return { ok: true, idToken: parsed.data.idToken };
}
