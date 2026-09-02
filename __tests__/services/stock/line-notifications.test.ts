import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    buildStockRequestResultLineEventKey,
    dispatchStockRequestResultLineOutbox,
} from "@/lib/services/stock/line-notifications";
import type { StockRequestResultLinePayload } from "@/lib/services/stock/notification-payloads";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";

const sendAppLineNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: sendAppLineNotificationMock,
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildPayload(
    status: StockRequestResultLinePayload["status"] = "ISSUED",
): StockRequestResultLinePayload {
    const eventKey = buildStockRequestResultLineEventKey(55, status);
    return {
        schemaVersion: 1,
        requestId: 55,
        status,
        projectCode: "PRJ-55",
        recipient: {
            userId: 3,
            name: "สมชาย",
            email: "user@example.com",
        },
        items: [{ name: "กระดาษ", quantity: 2, unit: "รีม" }],
        cancelReason: status === "CANCELLED" ? "ไม่พร้อมจ่าย" : null,
        actedAt: "2026-08-05T08:00:00.000Z",
        retryKey: createLineRetryKey(eventKey),
    };
}

function buildNotification(payload: StockRequestResultLinePayload): NotificationOutbox {
    return {
        id: 800,
        type: "STOCK_REQUEST_RESULT_LINE",
        eventKey: buildStockRequestResultLineEventKey(
            payload.requestId,
            payload.status,
        ),
        payload: JSON.stringify(payload),
        status: "PROCESSING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe("Stock request result NHFapp LINE delivery", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(
            asNever({ id: 800 }),
        );
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.$transaction.mockImplementation((async (
            callback: (client: PrismaClient) => Promise<unknown>,
        ) => callback(prismaMock as never)) as never);
        sendAppLineNotificationMock.mockResolvedValue({ status: "SENT" });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("sends the requester result through Stock LIFF", async () => {
        const payload = buildPayload();

        await expect(dispatchStockRequestResultLineOutbox(
            buildNotification(payload),
            payload,
        )).resolves.toBe("SENT");

        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 3,
                retryKey: payload.retryKey,
            }),
        );
        const message = sendAppLineNotificationMock.mock.calls[0]?.[0]
            .message as { contents: { body?: { contents: unknown[] } } };
        expect(JSON.stringify(message)).toContain(
            "https://liff.line.me/nhfapp-liff-id/stock?requestId=55",
        );
    });

    it("supersedes an unlinked requester without failing the Stock action", async () => {
        const payload = buildPayload("CANCELLED");
        sendAppLineNotificationMock.mockResolvedValue({
            status: "SKIPPED",
            reason: "UNLINKED",
        });

        await expect(dispatchStockRequestResultLineOutbox(
            buildNotification(payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 800, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded Stock request result LINE delivery for unavailable recipient",
            },
        });
    });
});
