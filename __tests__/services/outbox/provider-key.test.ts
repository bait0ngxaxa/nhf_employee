import { describe, expect, it } from "vitest";

import {
    createEmailMessageId,
    createLineRetryKey,
    createOutboxLineRetryKey,
} from "@/lib/services/outbox/provider-key";

describe("outbox provider keys", () => {
    it("derives stable provider-safe keys from an event key", () => {
        const eventKey = "routine:44:reminder:2026-07-24T04:00:00.000Z:line:user:7";

        expect(createLineRetryKey(eventKey)).toBe(
            createLineRetryKey(eventKey),
        );
        expect(createLineRetryKey(eventKey)).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(createEmailMessageId(eventKey)).toBe(
            `<nhf-${createLineRetryKey(eventKey)}@notifications.thainhf.org>`,
        );
        expect(createEmailMessageId(`${eventKey}:other`)).not.toBe(
            createEmailMessageId(eventKey),
        );
    });

    it("derives distinct stable keys for different outbox rows", () => {
        const first = createOutboxLineRetryKey("STOCK_REQUEST_LINE", 41);
        const retry = createOutboxLineRetryKey("STOCK_REQUEST_LINE", 41);
        const second = createOutboxLineRetryKey("STOCK_REQUEST_LINE", 42);

        expect(first).toBe(retry);
        expect(first).not.toBe(second);
        expect(first).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
    });

    it("prefers a stable event key and falls back for historical rows", () => {
        const eventKey = "email-request:77:created";

        expect(createOutboxLineRetryKey("EMAIL_REQUEST", 77, eventKey))
            .toBe(createLineRetryKey(eventKey));
        expect(createOutboxLineRetryKey("EMAIL_REQUEST", 77, "   "))
            .toBe(createOutboxLineRetryKey("EMAIL_REQUEST", 77));
    });
});
