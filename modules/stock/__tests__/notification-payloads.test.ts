import { describe, expect, it } from "vitest";

import {
    buildStockRequestResultEmailPayload,
    parseStockRequestResultEmailPayload,
    type StockRequestResultEmailPayload,
    type StockRequestResultEmailSource,
} from "../infrastructure/notifications/notification-payloads";

const actedAt = new Date("2026-08-05T08:00:00.000Z");

const baseRequest = {
    id: 123,
    requestedBy: 7,
    projectCode: "PROJ-001",
    status: "PENDING_ISSUE",
    requester: {
        id: 7,
        name: "สมชาย",
        email: "user@example.com",
        employee: null,
    },
    items: [
        {
            id: 1,
            itemId: 10,
            variantId: 20,
            quantity: 2,
            item: {
                name: "ถุงมือ",
                unit: "คู่",
            },
            variant: {
                unit: "กล่อง",
                attributeValues: [
                    {
                        attributeValue: {
                            value: "แดง",
                            attribute: { name: "สี" },
                        },
                    },
                ],
            },
        },
    ],
} satisfies StockRequestResultEmailSource;

function buildPayload(
    requesterName: string,
): StockRequestResultEmailPayload {
    return buildStockRequestResultEmailPayload(
        {
            ...baseRequest,
            requester: { ...baseRequest.requester, name: requesterName },
        },
        "ISSUED",
        null,
        actedAt,
    );
}

describe("stock request result email payload", () => {
    it.each([
        ["รักษาชื่อปกติ", "สมชาย", "สมชาย"],
        ["trim whitespace", "  สมชาย  ", "สมชาย"],
        ["empty name fallback", "", "user@example.com"],
        ["whitespace-only name fallback", "   ", "user@example.com"],
    ])("normalizes requester name: %s", (_caseName, input, expected) => {
        const payload = buildPayload(input);

        expect(payload.recipient.name).toBe(expected);
    });

    it("preserves issued item snapshot, variant label, and null cancel reason", () => {
        const payload = buildPayload("สมชาย");

        expect(payload).toMatchObject({
            requestId: 123,
            status: "ISSUED",
            projectCode: "PROJ-001",
            recipient: {
                userId: 7,
                name: "สมชาย",
                email: "user@example.com",
            },
            items: [{
                name: "ถุงมือ",
                quantity: 2,
                unit: "กล่อง",
                variantLabel: "สี: แดง",
            }],
            cancelReason: null,
            actedAt: actedAt.toISOString(),
        });
    });

    it("prefers a canonical Employee identity for the requester snapshot", () => {
        const payload = buildStockRequestResultEmailPayload(
            {
                ...baseRequest,
                requester: {
                    ...baseRequest.requester,
                    name: "ชื่อเดิม",
                    employee: {
                        firstName: "สมชาย",
                        lastName: "ใจดี",
                        nickname: "ชาย",
                    },
                },
            },
            "ISSUED",
            null,
            actedAt,
        );

        expect(payload.recipient.name).toBe("สมชาย ใจดี (ชาย)");
    });

    it("builds a cancelled payload with a cancellation reason", () => {
        const payload = buildStockRequestResultEmailPayload(
            baseRequest,
            "CANCELLED",
            "วัสดุไม่พร้อมจ่าย",
            actedAt,
        );

        expect(payload.status).toBe("CANCELLED");
        expect(payload.cancelReason).toBe("วัสดุไม่พร้อมจ่าย");
    });

    it("accepts valid email and trims surrounding whitespace", () => {
        const payload = buildPayload("สมชาย");
        const parsed = parseStockRequestResultEmailPayload({
            ...payload,
            recipient: {
                ...payload.recipient,
                email: "  user@example.com  ",
            },
        });

        expect(parsed.recipient.email).toBe("user@example.com");
    });

    it("accepts the legacy persisted payload shape", () => {
        const payload = buildPayload("สมชาย");

        expect(parseStockRequestResultEmailPayload(payload)).toEqual(payload);
    });

    it("rejects an invalid recipient email with the safe parser error", () => {
        const payload = buildPayload("สมชาย");

        expect(() => parseStockRequestResultEmailPayload({
            ...payload,
            recipient: {
                ...payload.recipient,
                email: "invalid-email",
            },
        })).toThrow("Invalid STOCK_REQUEST_RESULT_EMAIL payload");
    });
});
