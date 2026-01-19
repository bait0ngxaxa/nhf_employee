import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sendLineMessage,
    sendLineBroadcast,
    sendNewTicketNotification,
} from "@/lib/line";

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("LINE Notification Service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.LINE_CHANNEL_ACCESS_TOKEN = "test_token";
        process.env.LINE_IT_TEAM_USER_ID = "user_123";
        process.env.NEXTAUTH_URL = "http://localhost:3000";

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({}),
            text: async () => "",
        });
    });

    afterEach(() => {
        process.env = { ...process.env }; // Restore env ? No, Node process.env is object reference usually
        // Better to not mess up cleaning, but beforeEach sets what we need.
    });

    describe("sendLineMessage", () => {
        it("should send push message", async () => {
            const result = await sendLineMessage("user1", {
                type: "text",
                text: "Hello",
            });
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
            delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
            const result = await sendLineMessage("user1", {
                type: "text",
                text: "Hello",
            });
            expect(result).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("should handle API failure", async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                text: async () => "Error msg",
                status: 400,
            });
            const result = await sendLineMessage("user1", {
                type: "text",
                text: "Hello",
            });
            expect(result).toBe(false);
        });
    });

    describe("sendLineBroadcast", () => {
        it("should send broadcast", async () => {
            const result = await sendLineBroadcast({
                type: "text",
                text: "Hello",
            });
            expect(result).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/broadcast",
                expect.anything(),
            );
        });
    });

    describe("sendNewTicketNotification", () => {
        it("should use IT Team User ID if present (Push)", async () => {
            process.env.LINE_IT_TEAM_USER_ID = "it_user";
            const ticket = {
                ticketId: 1,
                title: "T",
                description: "D",
                status: "OPEN",
                priority: "HIGH",
                reportedBy: { name: "U" },
            } as any;

            await sendNewTicketNotification(ticket);

            // Should verify it called sendLineMessage (Push)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/push",
                expect.anything(),
            );
        });

        it("should use Broadcast if IT Team ID missing", async () => {
            delete process.env.LINE_IT_TEAM_USER_ID;
            const ticket = {
                ticketId: 1,
                title: "T",
                description: "D",
                status: "OPEN",
                priority: "HIGH",
                reportedBy: { name: "U" },
            } as any;

            await sendNewTicketNotification(ticket);

            expect(fetchMock).toHaveBeenCalledWith(
                "https://api.line.me/v2/bot/message/broadcast",
                expect.anything(),
            );
        });
    });
});
