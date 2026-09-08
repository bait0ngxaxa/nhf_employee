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

type LineRequestBodyResult =
    | { ok: true; body: string }
    | { ok: false; reason: "too-large" | "read-error" };

async function readRequestBodyWithinLimit(
    request: NextRequest,
): Promise<LineRequestBodyResult> {
    const stream = request.body;
    if (!stream) return { ok: true, body: "" };

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            totalBytes += value.byteLength;
            if (totalBytes > LINE_AUTH_MAX_REQUEST_BYTES) {
                try {
                    await reader.cancel();
                } catch {
                    // The request is already known to exceed the hard limit.
                }
                return { ok: false, reason: "too-large" };
            }
            chunks.push(value);
        }
    } catch {
        return { ok: false, reason: "read-error" };
    } finally {
        reader.releaseLock();
    }

    const bodyBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bodyBytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return { ok: true, body: new TextDecoder().decode(bodyBytes) };
}

export async function readLineIdToken(
    request: NextRequest,
): Promise<
    | { ok: true; idToken: string }
    | { ok: false; response: NextResponse }
> {
    const bodyResult = await readRequestBodyWithinLimit(request);
    if (!bodyResult.ok) {
        return {
            ok: false,
            response: bodyResult.reason === "too-large"
                ? jsonError("คำขอมีขนาดใหญ่เกินไป", 413)
                : badRequest(),
        };
    }

    let body: unknown;
    try {
        body = JSON.parse(bodyResult.body) as unknown;
    } catch {
        return { ok: false, response: badRequest() };
    }

    const parsed = lineIdTokenRequestSchema.safeParse(body);
    if (!parsed.success) {
        return { ok: false, response: badRequest() };
    }

    return { ok: true, idToken: parsed.data.idToken };
}
