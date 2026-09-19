import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEmailRequests } from "@/lib/services/email-request/queries";

vi.mock("@/lib/db/prisma", () => ({
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
        it("should return all requests for an ALL read grant", async () => {
            const authorization = { userId: 1, scopes: ["ALL"] as const };
            prismaMock.emailRequest.count.mockResolvedValue(1);
            prismaMock.emailRequest.findMany.mockResolvedValue([
                { id: 1 },
            ] as never);

            await getEmailRequests({ page: 1, limit: 10 }, authorization);

            expect(prismaMock.emailRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {}, // No restriction
                }),
            );
        });

        it("should return only own requests for an OWN read grant", async () => {
            const authorization = { userId: 2, scopes: ["OWN"] as const };
            prismaMock.emailRequest.count.mockResolvedValue(1);
            prismaMock.emailRequest.findMany.mockResolvedValue([
                { id: 1 },
            ] as never);

            await getEmailRequests({ page: 1, limit: 10 }, authorization);

            expect(prismaMock.emailRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { requestedBy: 2 }, // Restricted
                }),
            );
        });

        it("uses broad query breadth when OWN and ALL are both effective", async () => {
            const authorization = { userId: 2, scopes: ["OWN", "ALL"] as const };
            prismaMock.emailRequest.count.mockResolvedValue(1);
            prismaMock.emailRequest.findMany.mockResolvedValue([
                { id: 1 },
            ] as never);

            await getEmailRequests({ page: 1, limit: 10 }, authorization);

            expect(prismaMock.emailRequest.count).toHaveBeenCalledWith({ where: {} });
            expect(prismaMock.emailRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: {} }),
            );
        });

        it("fails before querying when no read scope is present", async () => {
            await expect(
                getEmailRequests({ page: 1, limit: 10 }, { userId: 2, scopes: [] }),
            ).rejects.toThrow("Email Request read authorization has no supported scope");
            expect(prismaMock.emailRequest.count).not.toHaveBeenCalled();
            expect(prismaMock.emailRequest.findMany).not.toHaveBeenCalled();
        });
    });
});
