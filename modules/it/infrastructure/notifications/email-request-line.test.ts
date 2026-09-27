import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendAppLineNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: sendAppLineNotificationMock,
}));

import { sendEmailRequestLineNotification } from "./email-request-line";

describe("Email Request personal NHFapp LINE notification", () => {
    beforeEach(() => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");
        sendAppLineNotificationMock.mockResolvedValue({ status: "SENT" });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("uses the application user id, stable retry key, and canonical Dashboard destination", async () => {
        await expect(sendEmailRequestLineNotification({
            userId: 10,
            emailRequestId: 77,
            retryKey: "stable-line-retry-key",
        })).resolves.toEqual({ status: "SENT" });

        expect(sendAppLineNotificationMock).toHaveBeenCalledOnce();
        const [input] = sendAppLineNotificationMock.mock.calls[0] ?? [];
        expect(input).toMatchObject({
            userId: 10,
            retryKey: "stable-line-retry-key",
        });
        const serialized = JSON.stringify(input.message);
        expect(serialized).toContain("คำร้องอีเมลพนักงานใหม่ #77");
        expect(serialized).toContain("https://app.example.com/dashboard/email-request");
        expect(serialized).not.toContain("somchai@example.com");
        expect(serialized).not.toContain("replyEmail");
        expect(serialized).not.toContain("phone");
    });

    it("supersedes a missing public destination without invoking LINE", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "");

        await expect(sendEmailRequestLineNotification({
            userId: 10,
            emailRequestId: null,
            retryKey: "stable-line-retry-key",
        })).resolves.toEqual({
            status: "SKIPPED",
            reason: "INVALID_DESTINATION",
        });
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });
});
