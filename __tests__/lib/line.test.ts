import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sendLineMessage,
    sendLineBroadcast,
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

});
