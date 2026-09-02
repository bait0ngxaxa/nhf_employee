import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { sendStockRequestResultNotification } from "@/lib/email";
import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { buildStockRequestResultLineEventKey } from "@/lib/services/stock/line-notifications";
import type { StockRequestResultLinePayload } from "@/lib/services/stock/notification-payloads";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";

const sendAppLineNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: sendAppLineNotificationMock,
}));

vi.mock("@/lib/email", () => ({
    sendStockRequestResultNotification: vi.fn(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildPayload(): StockRequestResultLinePayload {
    const eventKey = buildStockRequestResultLineEventKey(55, "ISSUED");
    return {
        schemaVersion: 1,
        requestId: 55,
        status: "ISSUED",
        projectCode: "PRJ-55",
        recipient: {
            userId: 3,
            name: "สมชาย",
            email: "user@example.com",
        },
        items: [{ name: "กระดาษ", quantity: 2, unit: "รีม" }],
        cancelReason: null,
        actedAt: "2026-08-05T08:00:00.000Z",
        retryKey: createLineRetryKey(eventKey),
    };
}

function buildNotification(payload: StockRequestResultLinePayload): NotificationOutbox {
    return {
        id: 900,
        type: "STOCK_REQUEST_RESULT_LINE",
        eventKey: buildStockRequestResultLineEventKey(
            payload.requestId,
            payload.status,
        ),
        payload: JSON.stringify(payload),
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe("personal LINE outbox processor isolation", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(
            asNever({ id: 900 }),
        );
        prismaMock.$transaction.mockImplementation((async (
            callback: (client: PrismaClient) => Promise<unknown>,
        ) => callback(prismaMock as never)) as never);
        sendAppLineNotificationMock.mockRejectedValue(
            new Error("temporary NHFapp LINE outage"),
        );
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("retries only the LINE child when the provider fails", async () => {
        const payload = buildPayload();
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([buildNotification(payload)]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(sendStockRequestResultNotification).not.toHaveBeenCalled();
        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 3,
                retryKey: payload.retryKey,
            }),
        );
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 900, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "Stock request result LINE delivery failed",
                }),
            }),
        );
    });
});
