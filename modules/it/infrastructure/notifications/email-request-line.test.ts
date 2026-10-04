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
        expect(input.message.altText).toBe("IT: มีคำขออีเมลพนักงานใหม่ #77");
        expect(input.message.contents.body?.contents[0]).toMatchObject({ text: "มีคำขออีเมลพนักงานใหม่" });
        const serialized = JSON.stringify(input.message);
        expect(serialized).toContain("คำขออีเมลพนักงานใหม่ #77");
        expect(serialized).toContain("https://app.example.com/dashboard/email-request");
        expect(serialized).not.toContain("somchai@example.com");
        expect(serialized).not.toContain("replyEmail");
        expect(serialized).not.toContain("phone");
    });

    it("propagates a missing public origin to the outbox retry lifecycle", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "");

        await expect(sendEmailRequestLineNotification({
            userId: 10,
            emailRequestId: null,
            retryKey: "stable-line-retry-key",
        })).rejects.toThrow("PUBLIC_APPROVE_URL is required in production.");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it("says access update in LINE without employee contact information", async () => {
        await sendEmailRequestLineNotification({ userId: 10, emailRequestId: 77, accessVersion: 2, retryKey: "access-update-key" });
        const serialized = JSON.stringify(sendAppLineNotificationMock.mock.calls[0]?.[0]);
        expect(serialized).toContain("มีการอัปเดตสิทธิ์พนักงานใหม่");
        expect(serialized).toContain("มีการระบุหรือแก้ไขสิทธิ์การใช้งานเพิ่มเติม");
        expect(serialized).not.toContain("มีคำขออีเมลพนักงานใหม่รอตรวจสอบ");
        expect(serialized).not.toMatch(/phone|081/);
    });
});
