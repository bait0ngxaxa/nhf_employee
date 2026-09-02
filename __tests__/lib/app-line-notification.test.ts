import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { sendLineAppMessage } from "@/lib/line/messaging";
import { sendAppLineNotification } from "@/lib/line/app-notification";
import type { LineFlexMessage } from "@/types/api";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/line/messaging", () => ({
    sendLineAppMessage: vi.fn(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const sendLineAppMessageMock = vi.mocked(sendLineAppMessage);

const message: LineFlexMessage = {
    type: "flex",
    altText: "ทดสอบการแจ้งเตือน",
    contents: { type: "bubble" },
};
const retryKey = "123e4567-e89b-42d3-a456-426614174000";

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildRecipient(overrides: Record<string, unknown> = {}): object {
    return {
        isActive: true,
        deletedAt: null,
        employeeId: 10,
        employee: { status: "ACTIVE", deletedAt: null },
        lineAccountLink: { lineUserId: "U-linked" },
        ...overrides,
    };
}

describe("sendAppLineNotification", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        sendLineAppMessageMock.mockResolvedValue(true);
    });

    it("resolves a linked active user and forwards the provider retry key", async () => {
        prismaMock.user.findUnique.mockResolvedValue(asNever(buildRecipient()));

        const result = await sendAppLineNotification({
            userId: 10,
            message,
            retryKey,
        });

        expect(result).toEqual({ status: "SENT" });
        expect(sendLineAppMessageMock).toHaveBeenCalledWith(
            "U-linked",
            message,
            retryKey,
        );
    });

    it("skips an unlinked user without calling the LINE provider", async () => {
        prismaMock.user.findUnique.mockResolvedValue(asNever(
            buildRecipient({ lineAccountLink: null }),
        ));

        await expect(sendAppLineNotification({
            userId: 10,
            message,
            retryKey,
        })).resolves.toEqual({ status: "SKIPPED", reason: "UNLINKED" });
        expect(sendLineAppMessageMock).not.toHaveBeenCalled();
    });

    it.each([
        ["inactive user", { isActive: false }],
        ["deleted user", { deletedAt: new Date() }],
        ["inactive employee", { employee: { status: "INACTIVE", deletedAt: null } }],
        ["deleted employee", { employee: { status: "ACTIVE", deletedAt: new Date() } }],
    ])("skips an ineligible %s", async (_label, overrides) => {
        prismaMock.user.findUnique.mockResolvedValue(asNever(
            buildRecipient(overrides),
        ));

        await expect(sendAppLineNotification({
            userId: 10,
            message,
            retryKey,
        })).resolves.toEqual({ status: "SKIPPED", reason: "INELIGIBLE" });
        expect(sendLineAppMessageMock).not.toHaveBeenCalled();
    });

    it("raises a retryable error when the NHFapp provider fails", async () => {
        prismaMock.user.findUnique.mockResolvedValue(asNever(buildRecipient()));
        sendLineAppMessageMock.mockResolvedValue(false);

        await expect(sendAppLineNotification({
            userId: 10,
            message,
            retryKey,
        })).rejects.toThrow("NHFapp LINE notification failed");
        expect(sendLineAppMessageMock).toHaveBeenCalledWith(
            "U-linked",
            message,
            retryKey,
        );
    });
});

