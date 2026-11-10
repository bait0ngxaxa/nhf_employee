// @vitest-environment node
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { REQUEST_BODY_TOO_LARGE_MESSAGE } from "@/lib/ssot/request-limits";
import {
    buildJsonBodyRequest,
    CONTENT_LENGTH_MODES,
    jsonBodyOfExactBytes,
} from "@/__tests__/helpers/request-body-limit";

const URL = "http://localhost/api/test";
const invalidJson = (): NextResponse =>
    NextResponse.json({ error: "route-specific malformed" }, { status: 418 });

describe("readRouteJsonBody", () => {
    it("returns the parsed body when it is exactly the limit, preserving Thai text", async () => {
        const body = jsonBodyOfExactBytes({ name: "พนักงาน" }, 64);

        const result = await readRouteJsonBody(buildJsonBodyRequest(URL, body), {
            maxBytes: 64,
            invalidJson,
        });

        expect(result).toEqual({ ok: true, body: { name: "พนักงาน" } });
    });

    it.each(CONTENT_LENGTH_MODES)(
        "returns 413 with the shared message one byte over the limit (Content-Length %s)",
        async (contentLength) => {
            const body = jsonBodyOfExactBytes({ name: "x" }, 65);

            const result = await readRouteJsonBody(
                buildJsonBodyRequest(URL, body, { contentLength }),
                { maxBytes: 64, invalidJson, tooLargeDetails: { success: false } },
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
    ])("delegates %s to the route's previous response", async (_label, body) => {
        const result = await readRouteJsonBody(buildJsonBodyRequest(URL, body), {
            maxBytes: 64,
            invalidJson,
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.response.status).toBe(418);
        await expect(result.response.json()).resolves.toEqual({ error: "route-specific malformed" });
    });

    it("keeps the 413 message byte-identical to the existing module messages", () => {
        expect(REQUEST_BODY_TOO_LARGE_MESSAGE).toBe("คำขอมีขนาดใหญ่เกินไป");
    });
});
