export type BoundedBytesResult =
    | { ok: true; bytes: Uint8Array }
    | { ok: false; reason: "TOO_LARGE" | "READ_FAILED" };

export type BoundedTextResult =
    | { ok: true; text: string; byteLength: number }
    | {
          ok: false;
          reason: "TOO_LARGE" | "READ_FAILED" | "INVALID_ENCODING";
      };

export type BoundedJsonResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: "TOO_LARGE" | "INVALID_JSON" };

function assertValidLimit(maxBytes: number): void {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
        throw new RangeError("maxBytes must be a non-negative safe integer");
    }
}

/**
 * Content-Length is an optimization only. The request stream is still read
 * and bounded by readBoundedBytes when the header is absent or inaccurate.
 */
export function contentLengthExceedsLimit(
    request: Request,
    maxBytes: number,
): boolean {
    assertValidLimit(maxBytes);
    const rawContentLength = request.headers.get("content-length")?.trim();
    if (!rawContentLength || !/^\d+$/.test(rawContentLength)) return false;

    try {
        return BigInt(rawContentLength) > BigInt(maxBytes);
    } catch {
        return false;
    }
}

export async function readBoundedBytes(
    request: Request,
    maxBytes: number,
): Promise<BoundedBytesResult> {
    assertValidLimit(maxBytes);
    if (contentLengthExceedsLimit(request, maxBytes)) {
        return { ok: false, reason: "TOO_LARGE" };
    }

    const body = request.body;
    if (!body) {
        return { ok: true, bytes: new Uint8Array() };
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            byteLength += value.byteLength;
            if (byteLength > maxBytes) {
                try {
                    await reader.cancel();
                } catch {
                    // The bounded result remains deterministic even if cancel fails.
                }
                return { ok: false, reason: "TOO_LARGE" };
            }
            chunks.push(value);
        }

        const bytes = new Uint8Array(byteLength);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return { ok: true, bytes };
    } catch {
        return { ok: false, reason: "READ_FAILED" };
    } finally {
        reader.releaseLock();
    }
}

export async function readBoundedTextBody(
    request: Request,
    maxBytes: number,
): Promise<BoundedTextResult> {
    const result = await readBoundedBytes(request, maxBytes);
    if (!result.ok) return result;

    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(result.bytes);
        return { ok: true, text, byteLength: result.bytes.byteLength };
    } catch {
        return { ok: false, reason: "INVALID_ENCODING" };
    }
}

export async function readBoundedJsonBody(
    request: Request,
    maxBytes: number,
): Promise<BoundedJsonResult> {
    const result = await readBoundedTextBody(request, maxBytes);
    if (!result.ok) {
        return {
            ok: false,
            reason: result.reason === "TOO_LARGE" ? "TOO_LARGE" : "INVALID_JSON",
        };
    }

    try {
        return { ok: true, value: JSON.parse(result.text) as unknown };
    } catch {
        return { ok: false, reason: "INVALID_JSON" };
    }
}
