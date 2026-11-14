// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { REQUEST_BODY_INVALID_JSON_MESSAGE, REQUEST_BODY_TOO_LARGE_MESSAGE } from "@/lib/ssot/request-limits";
import {
    buildJsonBodyRequest,
    CONTENT_LENGTH_MODES,
    jsonBodyOfExactBytes,
} from "@/__tests__/helpers/request-body-limit";

const URL = "http://localhost/api/test";

describe("readRouteJsonBody", () => {
    it("returns the parsed body when it is exactly the limit, preserving Thai text", async () => {
        const body = jsonBodyOfExactBytes({ name: "พนักงาน" }, 64);

        const result = await readRouteJsonBody(buildJsonBodyRequest(URL, body), {
            maxBytes: 64,
        });

        expect(result).toEqual({ ok: true, body: { name: "พนักงาน" } });
    });

    it.each(CONTENT_LENGTH_MODES)(
        "returns 413 with the shared message one byte over the limit (Content-Length %s)",
        async (contentLength) => {
            const body = jsonBodyOfExactBytes({ name: "x" }, 65);

            const result = await readRouteJsonBody(
                buildJsonBodyRequest(URL, body, { contentLength }),
                { maxBytes: 64, tooLargeDetails: { success: false } },
            );

            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.response.status).toBe(413);
            await expect(result.response.json()).resolves.toEqual({
                error: REQUEST_BODY_TOO_LARGE_MESSAGE,
                success: false,
            });
        },
    );

    it.each([
        ["malformed JSON", "{not json"],
        ["an empty body", ""],
    ])("returns the canonical 400 response for %s", async (_label, body) => {
        const result = await readRouteJsonBody(buildJsonBodyRequest(URL, body), {
            maxBytes: 64,
            invalidJsonDetails: { success: false },
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.response.status).toBe(400);
        await expect(result.response.text()).resolves.toBe(JSON.stringify({
            error: REQUEST_BODY_INVALID_JSON_MESSAGE, success: false,
        }));
    });

    it.each(["unreadable stream", "invalid UTF-8"])("returns 400 for %s", async (kind) => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                if (kind === "unreadable stream") controller.error(new Error("private read failure"));
                else { controller.enqueue(new Uint8Array([0xff])); controller.close(); }
            },
        });
        const request = new Request(URL, { method: "POST", body: stream, duplex: "half" } as RequestInit);
        const result = await readRouteJsonBody(request, { maxBytes: 64 });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.response.status).toBe(400);
        await expect(result.response.json()).resolves.toEqual({ error: REQUEST_BODY_INVALID_JSON_MESSAGE });
    });

    it("preserves the administration 400 contract byte-for-byte", async () => {
        const result = await readRouteJsonBody(buildJsonBodyRequest(URL, "{"), {
            maxBytes: 64, invalidJsonMessage: "Bad request", invalidJsonDetails: { code: "INVALID_INPUT" },
        });
        if (result.ok) throw new Error("Expected parse failure");
        expect(result.response.status).toBe(400);
        await expect(result.response.text()).resolves.toBe('{"error":"Bad request","code":"INVALID_INPUT"}');
    });

    it("cannot override the canonical message or status through envelope fields", async () => {
        const injected: Record<string, unknown> = { error: "injected", status: 500 };
        const result = await readRouteJsonBody(buildJsonBodyRequest(URL, "{"), {
            maxBytes: 64, invalidJsonDetails: injected,
        });
        if (result.ok) throw new Error("Expected parse failure");
        expect(result.response.status).toBe(400);
        await expect(result.response.json()).resolves.toEqual({ error: REQUEST_BODY_INVALID_JSON_MESSAGE, status: 500 });
    });

    it("keeps the 413 message byte-identical to the existing module messages", () => {
        expect(REQUEST_BODY_TOO_LARGE_MESSAGE).toBe("คำขอมีขนาดใหญ่เกินไป");
    });
});
