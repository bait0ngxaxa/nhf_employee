import { describe, expect, it } from "vitest";

import {
    readBoundedBytes,
    readBoundedJsonBody,
    readBoundedTextBody,
} from "@/lib/server/request-body";

function requestWithBody(
    body: ArrayBuffer | string,
    headers: Record<string, string> = {},
): Request {
    return new Request("http://localhost/api/test", {
        method: "POST",
        headers,
        body,
    });
}

describe("bounded request body reader", () => {
    it("parses valid JSON below the limit", async () => {
        const result = await readBoundedJsonBody(
            requestWithBody(JSON.stringify({ name: "พนักงาน" }), {
                "content-type": "application/json",
            }),
            32 * 1024,
        );

        expect(result).toEqual({
            ok: true,
            value: { name: "พนักงาน" },
        });
    });

    it("classifies malformed JSON separately from an oversized body", async () => {
        const result = await readBoundedJsonBody(
            requestWithBody("{invalid", { "content-type": "application/json" }),
            32 * 1024,
        );

        expect(result).toEqual({ ok: false, reason: "INVALID_JSON" });
    });

    it("rejects a header that is already above the limit without reading the body", async () => {
        const result = await readBoundedJsonBody(
            requestWithBody("{}", {
                "content-type": "application/json",
                "content-length": String(32 * 1024 + 1),
            }),
            32 * 1024,
        );

        expect(result).toEqual({ ok: false, reason: "TOO_LARGE" });
    });

    it("rejects an oversized body when Content-Length is missing", async () => {
        const bytes = new Uint8Array(32 * 1024 + 1);
        const buffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buffer).set(bytes);

        const result = await readBoundedJsonBody(
            requestWithBody(buffer, { "content-type": "application/json" }),
            32 * 1024,
        );

        expect(result).toEqual({ ok: false, reason: "TOO_LARGE" });
    });

    it("rejects a body that is larger than a lying Content-Length", async () => {
        const body = "a".repeat(32 * 1024 + 1);
        const result = await readBoundedTextBody(
            requestWithBody(body, { "content-length": "10" }),
            32 * 1024,
        );

        expect(result).toEqual({ ok: false, reason: "TOO_LARGE" });
    });

    it("accepts the exact byte boundary and rejects one byte over", async () => {
        const exactBytes = new Uint8Array(64);
        const exactBuffer = new ArrayBuffer(exactBytes.byteLength);
        new Uint8Array(exactBuffer).set(exactBytes);
        const exactResult = await readBoundedBytes(
            requestWithBody(exactBuffer),
            exactBytes.byteLength,
        );

        const overResult = await readBoundedTextBody(
            requestWithBody("a".repeat(exactBytes.byteLength + 1)),
            exactBytes.byteLength,
        );

        expect(exactResult).toMatchObject({ ok: true });
        expect(overResult).toEqual({ ok: false, reason: "TOO_LARGE" });
    });

    it("counts UTF-8 bytes rather than JavaScript characters", async () => {
        const text = "พนักงาน";
        const encodedLength = new TextEncoder().encode(text).byteLength;
        expect(encodedLength).toBeGreaterThan(text.length);

        const accepted = await readBoundedTextBody(
            requestWithBody(text),
            encodedLength,
        );
        const rejected = await readBoundedTextBody(
            requestWithBody(text),
            encodedLength - 1,
        );

        expect(accepted).toMatchObject({ ok: true, byteLength: encodedLength });
        expect(rejected).toEqual({ ok: false, reason: "TOO_LARGE" });
    });
});
