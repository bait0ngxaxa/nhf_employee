import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { createEmailRequest } from "@/lib/services/email-request/mutations";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("Email Request Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$transaction.mockImplementation(async (arg) => {
            if (Array.isArray(arg)) {
                return Promise.all(arg);
            }

            const callback = arg as (client: PrismaClient) => unknown;
            return callback(prismaMock as unknown as PrismaClient);
        });
    });

    describe("createEmailRequest", () => {
        it("should create request and enqueue notification", async () => {
            const data = {
                thaiName: "T",
                englishName: "E",
                phone: "123",
                department: "D",
                position: "P",
                replyEmail: "r@e.c",
                nickname: "N",
            };
            prismaMock.emailRequest.create.mockResolvedValue(
                asNever({
                    id: 1,
                    ...data,
                    requestedBy: 1,
                }),
            );

            const user = { id: 1, role: "USER", email: "" };
            const result = await createEmailRequest(data, user);

            expect(result.success).toBe(true);
            expect(prismaMock.emailRequest.create).toHaveBeenCalled();
            expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: "EMAIL_REQUEST",
                        payload: expect.stringContaining("T"),
                    }),
                }),
            );
        });
    });
});


