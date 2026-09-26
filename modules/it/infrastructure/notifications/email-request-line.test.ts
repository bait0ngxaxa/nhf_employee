import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailRequestData } from "../../domain/email-request/contracts";
import { formatDate } from "@/lib/line/helpers";
import { generateEmailRequestFlexMessage } from "./email-request-flex";

const mocks = vi.hoisted(() => ({
    sendLineMessage: vi.fn(),
    sendLineBroadcast: vi.fn(),
}));

vi.mock("@/lib/line", () => ({
    sendLineMessage: mocks.sendLineMessage,
    sendLineBroadcast: mocks.sendLineBroadcast,
}));
vi.mock("@/lib/network/public-url", () => ({
    getPublicOrigin: () => "https://app.example.com",
}));

import {
    sendEmailRequestLineNotification,
} from "./email-request-line";

const PAYLOAD: EmailRequestData = {
    thaiName: "สมชาย ใจดี",
    englishName: "Somchai Jaidee",
    phone: "081-2345678",
    nickname: "ชาย",
    position: "เจ้าหน้าที่",
    department: "มสช.",
    replyEmail: "somchai@example.com",
    needsDocumentSystem: true,
    sharedDriveAccess: ["it", "account"],
    requestedAt: "2026-09-20T03:00:00.000Z",
};

function collectText(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectText);
    if (typeof value !== "object" || value === null) return [];

    const record = value as Record<string, unknown>;
    const current = record.type === "text" && typeof record.text === "string"
        ? [record.text]
        : [];
    return [...current, ...Object.values(record).flatMap(collectText)];
}

describe("IT Email Request LINE compatibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendLineMessage.mockResolvedValue(true);
        mocks.sendLineBroadcast.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("preserves Flex content fields and the existing Dashboard action URL", () => {
        const message = generateEmailRequestFlexMessage(PAYLOAD, "https://app.example.com");

        expect(message.altText).toBe("ส่งคำร้องพนักงานใหม่ - สมชาย ใจดี");
        expect(collectText(message)).toEqual([
            "📧 ส่งคำร้องพนักงานใหม่",
            "คำร้องพนักงานใหม่จากระบบ",
            "สมชาย ใจดี (Somchai Jaidee)",
            "ชื่อเล่น:",
            "ชาย",
            "สารบรรณ:",
            "ต้องการ",
            "Shared Drive:",
            "it, account",
            "เบอร์โทร:",
            "081-2345678",
            "ตำแหน่ง:",
            "เจ้าหน้าที่",
            "สังกัด:",
            "มสช.",
            "อีเมลตอบกลับ:",
            "somchai@example.com",
            "วันที่ขอ:",
            formatDate(PAYLOAD.requestedAt),
        ]);
        expect(message.contents.footer).toEqual(expect.objectContaining({
            contents: expect.arrayContaining([
                expect.objectContaining({
                    type: "button",
                    action: expect.objectContaining({
                        type: "uri",
                        label: "ดูคำร้องในระบบ",
                        uri: "https://app.example.com/dashboard/email-request",
                    }),
                }),
            ]),
        }));
    });

    it("pushes to LINE_IT_TEAM_USER_ID when configured and forwards the retry key", async () => {
        vi.stubEnv("LINE_IT_TEAM_USER_ID", "U-it-team");

        await expect(sendEmailRequestLineNotification(PAYLOAD, "stable-retry-key"))
            .resolves.toBe(true);

        expect(mocks.sendLineMessage).toHaveBeenCalledWith(
            "U-it-team",
            generateEmailRequestFlexMessage(PAYLOAD, "https://app.example.com"),
            "stable-retry-key",
        );
        expect(mocks.sendLineBroadcast).not.toHaveBeenCalled();
    });

    it("broadcasts through the IT channel when no target user is configured", async () => {
        vi.stubEnv("LINE_IT_TEAM_USER_ID", "");

        await expect(sendEmailRequestLineNotification(PAYLOAD, "stable-retry-key"))
            .resolves.toBe(true);

        expect(mocks.sendLineBroadcast).toHaveBeenCalledWith(
            generateEmailRequestFlexMessage(PAYLOAD, "https://app.example.com"),
            "stable-retry-key",
        );
        expect(mocks.sendLineMessage).not.toHaveBeenCalled();
    });
});
