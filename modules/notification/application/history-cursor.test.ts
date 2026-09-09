import { describe, expect, it } from "vitest";

import {
    decodeNotificationHistoryCursor,
    encodeNotificationHistoryCursor,
} from "./history-cursor";

const row = {
    createdAt: new Date("2026-09-09T10:00:00.000Z"),
    id: "notification-17",
};

describe("Notification history cursor", () => {
    it("round-trips an opaque versioned composite cursor", () => {
        const encoded = encodeNotificationHistoryCursor(row);

        expect(encoded).not.toContain("createdAt");
        expect(decodeNotificationHistoryCursor(encoded)).toEqual({
            kind: "composite",
            createdAt: row.createdAt,
            id: row.id,
        });
    });

    it("accepts a valid version-one composite cursor", () => {
        const encoded = Buffer.from(JSON.stringify({
            v: 1,
            createdAt: row.createdAt.toISOString(),
            id: row.id,
        }), "utf8").toString("base64url");

        expect(decodeNotificationHistoryCursor(encoded)).toEqual({
            kind: "composite",
            createdAt: row.createdAt,
            id: row.id,
        });
    });

    it("rejects unsupported cursor versions", () => {
        const encoded = Buffer.from(JSON.stringify({
            v: 2,
            createdAt: row.createdAt.toISOString(),
            id: row.id,
        }), "utf8").toString("base64url");

        expect(() => decodeNotificationHistoryCursor(encoded)).toThrow(
            "Unsupported notification history cursor version",
        );
    });

    it("keeps ISO timestamp cursors on the legacy path", () => {
        const timestamp = row.createdAt.toISOString();

        expect(decodeNotificationHistoryCursor(timestamp)).toEqual({
            kind: "legacy-timestamp",
            createdAt: row.createdAt,
        });
    });

    it.each([
        "not-a-valid-cursor",
        Buffer.from(JSON.stringify({
            v: 1,
            createdAt: "not-a-timestamp",
            id: row.id,
        }), "utf8").toString("base64url"),
        Buffer.from(JSON.stringify({
            v: 1,
            createdAt: row.createdAt.toISOString(),
            id: "",
        }), "utf8").toString("base64url"),
    ])("rejects malformed cursor %s", (cursor) => {
        expect(() => decodeNotificationHistoryCursor(cursor)).toThrow(
            "Invalid notification history cursor",
        );
    });
});
