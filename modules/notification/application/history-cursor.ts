import type { NotificationHistoryCursor } from "./types";

const HISTORY_CURSOR_VERSION = 1;
const MAX_NOTIFICATION_ID_LENGTH = 191;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const NOTIFICATION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

type HistoryCursorPayload = {
    v: number;
    createdAt: string;
    id: string;
};

function invalidCursorError(): Error {
    return new Error("Invalid notification history cursor");
}

function unsupportedCursorVersionError(): Error {
    return new Error("Unsupported notification history cursor version");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseTimestamp(value: unknown): Date | null {
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isValidNotificationId(value: unknown): value is string {
    return (
        typeof value === "string"
        && value.length > 0
        && value.length <= MAX_NOTIFICATION_ID_LENGTH
        && NOTIFICATION_ID_PATTERN.test(value)
    );
}

function parseLegacyTimestampCursor(cursor: string): NotificationHistoryCursor {
    const createdAt = parseTimestamp(cursor);
    if (!createdAt) {
        throw invalidCursorError();
    }

    return { kind: "legacy-timestamp", createdAt };
}

function decodeCompositeCursor(cursor: string): NotificationHistoryCursor {
    let payload: unknown;

    try {
        const decoded = Buffer.from(cursor, "base64url");
        if (
            decoded.length === 0
            || decoded.toString("base64url") !== cursor
        ) {
            throw invalidCursorError();
        }
        payload = JSON.parse(decoded.toString("utf8")) as unknown;
    } catch {
        throw invalidCursorError();
    }

    if (!isRecord(payload)) {
        throw invalidCursorError();
    }

    if (payload.v !== HISTORY_CURSOR_VERSION) {
        if (typeof payload.v === "number") {
            throw unsupportedCursorVersionError();
        }
        throw invalidCursorError();
    }

    const createdAt = parseTimestamp(payload.createdAt);
    if (!createdAt || !isValidNotificationId(payload.id)) {
        throw invalidCursorError();
    }

    return {
        kind: "composite",
        createdAt,
        id: payload.id,
    };
}

export function encodeNotificationHistoryCursor(input: {
    createdAt: Date;
    id: string;
}): string {
    if (
        Number.isNaN(input.createdAt.getTime())
        || !isValidNotificationId(input.id)
    ) {
        throw invalidCursorError();
    }

    const payload: HistoryCursorPayload = {
        v: HISTORY_CURSOR_VERSION,
        createdAt: input.createdAt.toISOString(),
        id: input.id,
    };

    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeNotificationHistoryCursor(
    cursor: string | null,
): NotificationHistoryCursor | null {
    if (!cursor) {
        return null;
    }

    return BASE64_URL_PATTERN.test(cursor)
        ? decodeCompositeCursor(cursor)
        : parseLegacyTimestampCursor(cursor);
}
