import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import type { PrismaClient } from "@prisma/client";
import { listEmployees } from "./employee-queries";

// Mock prisma module
vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Employee Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("getEmployees", () => {
        it("should return paginated employees with default filters", async () => {
            // Arrange
            const mockEmployees = [
                { id: 1, firstName: "John", lastName: "Doe" },
                { id: 2, firstName: "Jane", lastName: "Doe" },
            ];
            prismaMock.employee.count.mockResolvedValue(2);
            prismaMock.employee.findMany.mockResolvedValue(
                mockEmployees as never,
            );

            // Act
            const result = await listEmployees({ page: 1, limit: 10 });

            // Assert
            expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 10,
                }),
            );
            expect(result.employees).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
            expect(result.pagination.totalPages).toBe(1);
        });

        it("should search first name, last name, nickname, and existing identity fields", async () => {
            // Arrange
            prismaMock.employee.count.mockResolvedValue(0);
            prismaMock.employee.findMany.mockResolvedValue([]);

            // Act
            await listEmployees({ page: 1, limit: 10, search: "ชาย" });

            // Assert
            expect(prismaMock.employee.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            { firstName: { contains: "ชาย" } },
                            { lastName: { contains: "ชาย" } },
                            { nickname: { contains: "ชาย" } },
                            { email: { contains: "ชาย" } },
                            { position: { contains: "ชาย" } },
                            { affiliation: { contains: "ชาย" } },
                            { dept: { name: { contains: "ชาย" } } },
                        ]),
                    }),
                }),
            );
        });

        it("should apply status filter correctly", async () => {
            // Act
            await listEmployees({ page: 1, limit: 10, status: "ACTIVE" });

            // Assert
            expect(prismaMock.employee.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: "ACTIVE",
                    }),
                }),
            );
        });
    });

});
