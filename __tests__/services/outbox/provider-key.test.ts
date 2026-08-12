import { describe, expect, it } from "vitest";

import {
    createEmailMessageId,
    createLineRetryKey,
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
    });
});
