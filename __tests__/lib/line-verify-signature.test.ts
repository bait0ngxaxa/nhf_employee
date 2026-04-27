import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyLineSignature } from "@/lib/line/verify-signature";

// Helper to generate a valid HMAC-SHA256 signature for a given body + secret
function generateSignature(body: string, secret: string): string {
    return createHmac("SHA256", secret).update(body).digest("base64");
}

const IT_SECRET = "test-it-channel-secret";
const STOCK_SECRET = "test-stock-channel-secret";
const SAMPLE_BODY = JSON.stringify({ events: [{ type: "message" }] });

describe("verifyLineSignature", () => {
    it("should accept a valid signature from the IT bot secret", () => {
        const sig = generateSignature(SAMPLE_BODY, IT_SECRET);
        expect(verifyLineSignature(SAMPLE_BODY, sig, [IT_SECRET, STOCK_SECRET])).toBe(true);
    });

    it("should accept a valid signature from the Stock bot secret", () => {
        const sig = generateSignature(SAMPLE_BODY, STOCK_SECRET);
        expect(verifyLineSignature(SAMPLE_BODY, sig, [IT_SECRET, STOCK_SECRET])).toBe(true);
    });

    it("should reject an invalid signature", () => {
        const sig = generateSignature(SAMPLE_BODY, "wrong-secret");
        expect(verifyLineSignature(SAMPLE_BODY, sig, [IT_SECRET, STOCK_SECRET])).toBe(false);
    });

    it("should reject when signature header is empty", () => {
        expect(verifyLineSignature(SAMPLE_BODY, "", [IT_SECRET])).toBe(false);
    });

    it("should reject when no channel secrets are configured", () => {
        const sig = generateSignature(SAMPLE_BODY, IT_SECRET);
        expect(verifyLineSignature(SAMPLE_BODY, sig, [])).toBe(false);
    });

    it("should reject when body has been tampered with", () => {
        const sig = generateSignature(SAMPLE_BODY, IT_SECRET);
        const tamperedBody = JSON.stringify({ events: [{ type: "hacked" }] });
        expect(verifyLineSignature(tamperedBody, sig, [IT_SECRET])).toBe(false);
    });

    it("should work with a single secret", () => {
        const sig = generateSignature(SAMPLE_BODY, STOCK_SECRET);
        expect(verifyLineSignature(SAMPLE_BODY, sig, [STOCK_SECRET])).toBe(true);
    });
});
