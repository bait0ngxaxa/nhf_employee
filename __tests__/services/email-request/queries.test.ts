import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { getEmailRequests } from "@/lib/services/email-request/queries";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Email Request Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("getEmailRequests", () => {
        it("should return all requests for ADMIN", async () => {
            const user = { id: 1, role: "ADMIN", email: "" };
            prismaMock.emailRequest.count.mockResolvedValue(1);
            prismaMock.emailRequest.findMany.mockResolvedValue([
                { id: 1 },
            ] as any);

            await getEmailRequests({ page: 1, limit: 10 }, user);

            expect(prismaMock.emailRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {}, // No restriction
                }),
            );
        });

        it("should return only own requests for USER", async () => {
            const user = { id: 2, role: "USER", email: "" };
            prismaMock.emailRequest.count.mockResolvedValue(1);
            prismaMock.emailRequest.findMany.mockResolvedValue([
                { id: 1 },
            ] as any);

            await getEmailRequests({ page: 1, limit: 10 }, user);

            expect(prismaMock.emailRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { requestedBy: 2 }, // Restricted
                }),
            );
        });
    });
});
