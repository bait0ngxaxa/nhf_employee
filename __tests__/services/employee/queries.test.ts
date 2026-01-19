import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import {
    getEmployees,
    getEmployeeById,
    emailExists,
} from "@/lib/services/employee/queries";
import { PrismaClient } from "@prisma/client";

// Mock prisma module
vi.mock("@/lib/prisma", () => ({
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
                mockEmployees as any,
            );

            // Act
            const result = await getEmployees({ page: 1, limit: 10 });

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

        it("should apply search filter correctly", async () => {
            // Arrange
            prismaMock.employee.count.mockResolvedValue(0);
            prismaMock.employee.findMany.mockResolvedValue([]);

            // Act
            await getEmployees({ page: 1, limit: 10, search: "test" });

            // Assert
            expect(prismaMock.employee.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            { firstName: { contains: "test" } },
                            { email: { contains: "test" } },
                        ]),
                    }),
                }),
            );
        });

        it("should apply status filter correctly", async () => {
            // Act
            await getEmployees({ page: 1, limit: 10, status: "ACTIVE" });

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

    describe("getEmployeeById", () => {
        it("should return employee if found", async () => {
            const mockEmployee = { id: 1, firstName: "John" };
            prismaMock.employee.findUnique.mockResolvedValue(
                mockEmployee as any,
            );

            const result = await getEmployeeById(1);

            expect(result).toEqual(mockEmployee);
            expect(prismaMock.employee.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                }),
            );
        });

        it("should return null if not found", async () => {
            prismaMock.employee.findUnique.mockResolvedValue(null);

            const result = await getEmployeeById(999);

            expect(result).toBeNull();
        });
    });

    describe("emailExists", () => {
        it("should return true if email exists", async () => {
            prismaMock.employee.findUnique.mockResolvedValue({
                id: 1,
                email: "test@test.com",
            } as any);

            const result = await emailExists("test@test.com");

            expect(result).toBe(true);
        });

        it("should return false if email does not exist", async () => {
            prismaMock.employee.findUnique.mockResolvedValue(null);

            const result = await emailExists("new@test.com");

            expect(result).toBe(false);
        });

        it("should return false if email exists but belongs to excludeEmployeeId", async () => {
            prismaMock.employee.findUnique.mockResolvedValue({
                id: 1,
                email: "test@test.com",
            } as any);

            const result = await emailExists("test@test.com", 1);

            expect(result).toBe(false);
        });
    });
});
