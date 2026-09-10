// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/line/webhook/route";

const WEBHOOK_URL = "http://localhost/api/line/webhook";
const WEBHOOK_BODY = JSON.stringify({
    events: [{ source: { userId: "line-user" } }],
});

function createSignature(body: string, secret: string): string {
    return createHmac("SHA256", secret).update(body).digest("base64");
}

function buildRequest(signature?: string): NextRequest {
    const headers = signature === undefined
        ? undefined
        : { "x-line-signature": signature };

    return new NextRequest(WEBHOOK_URL, {
        method: "POST",
        headers,
        body: WEBHOOK_BODY,
    });
}

describe("LINE inbound webhook route", () => {
    beforeEach(() => {
        vi.stubEnv("LINE_IT_CHANNEL_SECRET", "");
        vi.stubEnv("LINE_STOCK_CHANNEL_SECRET", "");
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it("rejects a request without x-line-signature", async () => {
        const response = await POST(buildRequest());

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Missing x-line-signature header",
        });
    });

    it("returns a server misconfiguration response without channel secrets", async () => {
        const response = await POST(buildRequest("not-a-valid-signature"));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Server misconfigured",
        });
    });

    it("rejects an invalid signature", async () => {
        vi.stubEnv("LINE_IT_CHANNEL_SECRET", "it-channel-secret");

        const response = await POST(
            buildRequest(createSignature(WEBHOOK_BODY, "wrong-secret")),
        );

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Invalid signature",
        });
    });

    it.each([
        ["LINE_IT_CHANNEL_SECRET", "it-channel-secret"],
        ["LINE_STOCK_CHANNEL_SECRET", "stock-channel-secret"],
    ])("accepts a valid %s signature", async (environmentName, secret) => {
        vi.stubEnv(environmentName, secret);

        const response = await POST(buildRequest(createSignature(WEBHOOK_BODY, secret)));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ status: "ok" });
    });
});
