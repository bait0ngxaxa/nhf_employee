import { NextRequest } from "next/server";

const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
    return encoder.encode(text).byteLength;
}

/**
 * Serializes `value` and appends JSON whitespace so the body is exactly
 * `totalBytes` UTF-8 bytes. Trailing whitespace is valid JSON and leaves the
 * parsed value (and therefore schema validation, including `.strict()`)
 * unchanged.
 */
export function jsonBodyOfExactBytes(value: unknown, totalBytes: number): string {
    const json = JSON.stringify(value);
    const padding = totalBytes - utf8ByteLength(json);
    if (padding < 0) {
        throw new RangeError(
            `Serialized value is ${utf8ByteLength(json)} bytes, larger than ${totalBytes}`,
        );
    }
    return json + " ".repeat(padding);
}

export type ContentLengthMode =
    | "accurate"
    | "missing"
    /** Claims a small body while the stream carries more bytes. */
    | "lying";

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
    const chunkSize = 4096;
    let offset = 0;
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (offset >= bytes.byteLength) {
                controller.close();
                return;
            }
            controller.enqueue(bytes.slice(offset, offset + chunkSize));
            offset += chunkSize;
        },
    });
}

/**
 * Builds a JSON request whose Content-Length header is accurate, absent
 * (streamed body), or lying (header claims 2 bytes, stream sends the full body).
 */
export function buildJsonBodyRequest(
    url: string,
    body: string,
    options: {
        readonly method?: string;
        readonly headers?: Record<string, string>;
        readonly contentLength?: ContentLengthMode;
    } = {},
): NextRequest {
    const bytes = encoder.encode(body);
    const mode = options.contentLength ?? "accurate";
    const headers: Record<string, string> = {
        "content-type": "application/json",
        ...options.headers,
    };
    if (mode === "accurate") headers["content-length"] = String(bytes.byteLength);
    if (mode === "lying") headers["content-length"] = "2";

    const init = {
        method: options.method ?? "POST",
        headers,
        body: mode === "accurate" ? bytes : streamOf(bytes),
        duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1] & { duplex: "half" };
    return new NextRequest(url, init);
}

export const CONTENT_LENGTH_MODES: readonly ContentLengthMode[] = [
    "accurate",
    "missing",
    "lying",
];
