import { describe, expect, it } from "vitest";

import {
    readBoundedBytes,
    readBoundedFormData,
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

describe("bounded form-data reader", () => {
    function multipartRequest(
        build: (formData: FormData) => void,
        headers: Record<string, string> = {},
    ): Request {
        const formData = new FormData();
        build(formData);
        return new Request("http://localhost/api/test", {
            method: "POST",
            headers,
            body: formData,
        });
    }

    function streamingRequest(totalBytes: number, contentType: string): {
        request: Request;
        pulledBytes: () => number;
    } {
        let pulled = 0;
        const chunkSize = 1024;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (pulled >= totalBytes) {
                    controller.close();
                    return;
                }
                const size = Math.min(chunkSize, totalBytes - pulled);
                pulled += size;
                controller.enqueue(new Uint8Array(size));
            },
        });
        const request = new Request("http://localhost/api/test", {
            method: "POST",
            headers: { "content-type": contentType },
            body,
            duplex: "half",
        } as RequestInit & { duplex: "half" });
        return { request, pulledBytes: () => pulled };
    }

    it("parses fields and files within the limit, preserving Thai text", async () => {
        const result = await readBoundedFormData(
            multipartRequest((formData) => {
                formData.set("scope", "item");
                formData.set("note", "รูปสินค้า");
                formData.set("file", new File(["image"], "item.png", { type: "image/png" }));
            }),
            64 * 1024,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.formData.get("scope")).toBe("item");
        expect(result.formData.get("note")).toBe("รูปสินค้า");
        const file = result.formData.get("file");
        expect(file).toBeInstanceOf(File);
        expect((file as File).name).toBe("item.png");
        await expect((file as File).text()).resolves.toBe("image");
    });

    it("rejects from Content-Length without reading the body", async () => {
        const request = multipartRequest(
            (formData) => formData.set("scope", "item"),
            { "content-length": "2048" },
        );

        await expect(readBoundedFormData(request, 1024))
            .resolves.toEqual({ ok: false, reason: "TOO_LARGE" });
        expect(request.bodyUsed).toBe(false);
    });

    it("stops reading a stream without Content-Length once it exceeds the limit", async () => {
        const { request, pulledBytes } = streamingRequest(
            1024 * 1024,
            "multipart/form-data; boundary=x",
        );

        await expect(readBoundedFormData(request, 8 * 1024))
            .resolves.toEqual({ ok: false, reason: "TOO_LARGE" });
        expect(pulledBytes()).toBeLessThan(1024 * 1024);
    });

    it("reports malformed multipart and missing content type as INVALID_FORM_DATA", async () => {
        const malformed = new Request("http://localhost/api/test", {
            method: "POST",
            headers: { "content-type": "multipart/form-data; boundary=missing" },
            body: "not multipart",
        });
        const untyped = new Request("http://localhost/api/test", {
            method: "POST",
            body: new Uint8Array([1, 2, 3]),
        });

        await expect(readBoundedFormData(malformed, 1024))
            .resolves.toEqual({ ok: false, reason: "INVALID_FORM_DATA" });
        await expect(readBoundedFormData(untyped, 1024))
            .resolves.toEqual({ ok: false, reason: "INVALID_FORM_DATA" });
    });
});
