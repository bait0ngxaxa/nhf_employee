import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sendEmailRequestNotification,
    sendLineMessage,
    sendLineBroadcast,
    sendStockLineBroadcast,
    sendLineWebhook,
} from "@/lib/line";
import { sendLineAppMessage } from "@/lib/line/messaging";
import type { LineFlexMessage } from "@/types/api";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

const flexMessage: LineFlexMessage = {
    type: "flex",
    altText: "Hello",
    contents: {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [{ type: "text", text: "Hello" }],
        },
    },
};

const webhookData = {
    type: "email_request" as const,
    emailRequest: {
        thaiName: "Test",
        englishName: "Test",
        phone: "123",
        nickname: "",
        position: "IT",
        department: "IT",
        replyEmail: "test@example.com",
        needsDocumentSystem: false,
        sharedDriveAccess: [],
        requestedAt: "2026-07-01T03:00:00.000Z",
    },
    flexMessage,
};

describe("LINE Notification Service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("LINE_IT_CHANNEL_ACCESS_TOKEN", "test_token");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "nhfapp_test_token");
        vi.stubEnv("LINE_IT_TEAM_USER_ID", "user_123");
        vi.stubEnv("PUBLIC_APPROVE_URL", "http://localhost:3000");

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({}),
            text: async () => "",
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("sendLineMessage", () => {
        it("should send push message", async () => {
            const result = await sendLineMessage("user1", flexMessage);
            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/push",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: "Bearer test_token",
                    }),
                    body: expect.stringContaining("user1"),
                }),
            );
        });

        it("should fail if no token", async () => {
            delete process.env.LINE_IT_CHANNEL_ACCESS_TOKEN;
            const result = await sendLineMessage("user1", flexMessage);
            expect(result).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("should handle API failure", async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                text: async () => "Error msg",
                status: 400,
            });
            const result = await sendLineMessage("user1", flexMessage);
            expect(result).toBe(false);
        });

        it("uses retry key and accepts duplicate acknowledgement", async () => {
            const retryKey = "123e4567-e89b-52d3-a456-426614174000";
            fetchMock.mockResolvedValue({
                ok: false,
                text: async () => "",
                status: 409,
            });

            const result = await sendLineMessage(
                "user1",
                flexMessage,
                retryKey,
            );

            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/push",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-Line-Retry-Key": retryKey,
                    }),
                }),
            );
        });
    });

    describe("sendLineBroadcast", () => {
        it("should send broadcast", async () => {
            const result = await sendLineBroadcast(flexMessage);
            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/broadcast",
                expect.anything(),
            );
        });

        it("uses the retry key and treats an accepted duplicate as success", async () => {
            const retryKey = "123e4567-e89b-52d3-a456-426614174000";
            fetchMock.mockResolvedValue({ ok: false, status: 409 });

            const result = await sendLineBroadcast(flexMessage, retryKey);

            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/broadcast",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-Line-Retry-Key": retryKey,
                    }),
                }),
            );
        });

        it("does not treat a 409 without a retry key as accepted", async () => {
            fetchMock.mockResolvedValue({ ok: false, status: 409 });

            await expect(sendLineMessage("user1", flexMessage)).resolves.toBe(
                false,
            );
        });

        it("does not treat an empty retry key as an accepted duplicate", async () => {
            fetchMock.mockResolvedValue({ ok: false, status: 409 });

            await expect(sendLineBroadcast(flexMessage, "")).resolves.toBe(
                false,
            );
        });
    });

    describe("sendStockLineBroadcast", () => {
        it("continues to use the legacy Stock channel token", async () => {
            vi.stubEnv("LINE_STOCK_CHANNEL_ACCESS_TOKEN", "legacy-stock-token");
            const retryKey = "123e4567-e89b-52d3-a456-426614174000";

            const result = await sendStockLineBroadcast(flexMessage, retryKey);

            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/broadcast",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer legacy-stock-token",
                        "X-Line-Retry-Key": retryKey,
                    }),
                }),
            );
        });

        it("accepts a duplicate acknowledgement when the legacy broadcast is retried", async () => {
            vi.stubEnv("LINE_STOCK_CHANNEL_ACCESS_TOKEN", "legacy-stock-token");
            fetchMock.mockResolvedValue({ ok: false, status: 409 });

            await expect(sendStockLineBroadcast(
                flexMessage,
                "123e4567-e89b-52d3-a456-426614174000",
            )).resolves.toBe(true);
        });
    });

    describe("sendLineWebhook compatibility integration", () => {
        it("posts the legacy payload to the configured outbound URL", async () => {
            vi.stubEnv("LINE_WEBHOOK_URL", "https://hooks.example.com/line");

            const result = await sendLineWebhook(webhookData);

            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://hooks.example.com/line",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(webhookData),
                },
            );
        });

        it("does not call the network when the outbound URL is not configured", async () => {
            vi.stubEnv("LINE_WEBHOOK_URL", "");

            const result = await sendLineWebhook(webhookData);

            expect(result).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("sendLineAppMessage", () => {
        it("uses the NHFapp token and preserves the retry key", async () => {
            const retryKey = "123e4567-e89b-42d3-a456-426614174000";

            const result = await sendLineAppMessage(
                "routine-user",
                flexMessage,
                retryKey,
            );

            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/push",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer nhfapp_test_token",
                        "X-Line-Retry-Key": retryKey,
                    }),
                    body: expect.stringContaining("routine-user"),
                }),
            );
        });

        it("does not fall back to the IT token when NHFapp configuration is missing", async () => {
            delete process.env.LINE_APP_CHANNEL_ACCESS_TOKEN;

            const result = await sendLineAppMessage(
                "routine-user",
                flexMessage,
                "123e4567-e89b-42d3-a456-426614174000",
            );

            expect(result).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("treats a retry-key duplicate acknowledgement as accepted", async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 409,
            });

            const result = await sendLineAppMessage(
                "routine-user",
                flexMessage,
                "123e4567-e89b-42d3-a456-426614174000",
            );

            expect(result).toBe(true);
        });
    });

    it("treats a keyed 409 after provider acceptance as the same request across retryable channels", async () => {
        const retryKey = "123e4567-e89b-52d3-a456-426614174000";
        const emailRequest = {
            thaiName: "Test",
            englishName: "Test",
            phone: "123",
            nickname: "",
            position: "IT",
            department: "IT",
            replyEmail: "test@example.com",
            needsDocumentSystem: false,
            sharedDriveAccess: [],
            requestedAt: "2026-07-01T03:00:00.000Z",
        };
        const retryableRequests = [
            () => sendLineAppMessage("app-user", flexMessage, retryKey),
            () => sendStockLineBroadcast(flexMessage, retryKey),
            () => sendEmailRequestNotification(emailRequest, retryKey),
        ];

        for (const sendRequest of retryableRequests) {
            fetchMock.mockReset();
            fetchMock
                .mockResolvedValueOnce({ ok: true })
                .mockResolvedValueOnce({ ok: false, status: 409 });

            await expect(sendRequest()).resolves.toBe(true);
            await expect(sendRequest()).resolves.toBe(true);

            const firstRequest = fetchMock.mock.calls[0]?.[1];
            const retryRequest = fetchMock.mock.calls[1]?.[1];
            expect(firstRequest?.headers).toEqual(
                expect.objectContaining({ "X-Line-Retry-Key": retryKey }),
            );
            expect(retryRequest?.headers).toEqual(
                expect.objectContaining({ "X-Line-Retry-Key": retryKey }),
            );
            expect(firstRequest?.body).toBe(retryRequest?.body);
        }
    });

});
