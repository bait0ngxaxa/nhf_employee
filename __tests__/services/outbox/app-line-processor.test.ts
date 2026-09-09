import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { sendEmail } from "@/lib/email/transport";
import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    buildStockRequestResultLineEventKey,
    dispatchStockRequestResultLineOutbox,
} from "@/modules/stock";
import type { StockRequestResultLinePayload } from "@/modules/stock";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";

const sendAppLineNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: sendAppLineNotificationMock,
}));

vi.mock("@/lib/email/transport", () => ({
    sendEmail: vi.fn(),
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
        expect(sendEmail).not.toHaveBeenCalled();
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

    it("reuses the personal LINE retry key after a simulated crash before SENT", async () => {
        const payload = buildPayload();
        const notification = buildNotification(payload);
        sendAppLineNotificationMock.mockResolvedValue({ status: "SENT" });

        await expect(dispatchStockRequestResultLineOutbox(
            { ...notification, status: "PROCESSING" },
            payload,
        )).resolves.toBe("SENT");

        // The first provider call was accepted; no final Outbox update is made here.
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([notification]))
            .mockResolvedValueOnce(asNever([{
                ...notification,
                status: "FAILED" as const,
                attempts: 1,
                nextAttemptAt: new Date("2026-08-05T07:59:00.000Z"),
                updatedAt: new Date("2026-08-05T07:50:00.000Z"),
            }]));

        await expect(processOutbox()).resolves.toEqual({
            processed: 1,
            failed: 0,
        });

        expect(sendAppLineNotificationMock).toHaveBeenCalledTimes(2);
        expect(sendAppLineNotificationMock.mock.calls[0]?.[0].retryKey).toBe(
            sendAppLineNotificationMock.mock.calls[1]?.[0].retryKey,
        );
        expect(sendAppLineNotificationMock.mock.calls[0]?.[0].retryKey).toBe(
            payload.retryKey,
        );
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 900, status: "PROCESSING" },
                data: { status: "SENT", lastError: null },
            }),
        );
    });
});
