import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { createEmailRequest } from "@/lib/services/email-request/mutations";
import { PrismaClient } from "@prisma/client";
import { lineNotificationService } from "@/lib/line";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/line", () => ({
    lineNotificationService: {
        sendEmailRequestNotification: vi.fn().mockResolvedValue(undefined),
    },
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Email Request Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(
            lineNotificationService.sendEmailRequestNotification,
        ).mockClear();
    });

    describe("createEmailRequest", () => {
        it("should create request and send notification", async () => {
            const data = {
                thaiName: "T",
                englishName: "E",
                phone: "123",
                department: "D",
                position: "P",
                replyEmail: "r@e.c",
                nickname: "N",
            };
            prismaMock.emailRequest.create.mockResolvedValue({
                id: 1,
                ...data,
                requestedBy: 1,
            } as any);

            const user = { id: 1, role: "USER", email: "" };
            const result = await createEmailRequest(data, user);

            expect(result.success).toBe(true);
            expect(prismaMock.emailRequest.create).toHaveBeenCalled();

            // Wait for catch block promise (async non-await call)
            // Since it's a promise, we should check if it was called.
            // In node env, the validation might be sync enough or using setImmediate.
            // But here we mocked it.
            expect(
                lineNotificationService.sendEmailRequestNotification,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    thaiName: "T",
                }),
            );
        });
    });
});
