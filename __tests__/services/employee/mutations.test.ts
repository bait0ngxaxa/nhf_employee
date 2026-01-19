import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import {
    createEmployee,
    updateEmployee,
    deleteEmployee,
} from "@/lib/services/employee/mutations";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/services/employee/queries", () => ({
    emailExists: vi.fn(),
}));

import { emailExists } from "@/lib/services/employee/queries";

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Employee Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(emailExists).mockReset();
    });

    describe("createEmployee", () => {
        const mockData = {
            firstName: "John",
            lastName: "Doe",
            email: "john@test.com",
            position: "Dev",
            departmentId: 1,
        };

        it("should fail if email exists", async () => {
            vi.mocked(emailExists).mockResolvedValue(true);

            const result = await createEmployee(mockData);

            expect(result.success).toBe(false);
            expect(result.error).toContain("อีเมลนี้ถูกใช้งานแล้ว");
        });

        it("should create employee if valid", async () => {
            vi.mocked(emailExists).mockResolvedValue(false);
            prismaMock.employee.create.mockResolvedValue({
                id: 1,
                ...mockData,
            } as any);

            const result = await createEmployee(mockData);

            expect(result.success).toBe(true);
            expect(result.employee).toBeDefined();
            expect(prismaMock.employee.create).toHaveBeenCalled();
        });
    });

    describe("updateEmployee", () => {
        it("should fail if employee not found", async () => {
            prismaMock.employee.findUnique.mockResolvedValue(null);

            const result = await updateEmployee(999, { firstName: "New" });

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });

        it("should update basic fields", async () => {
            prismaMock.employee.findUnique.mockResolvedValue({
                id: 1,
                firstName: "Old",
            } as any);
            prismaMock.employee.update.mockResolvedValue({
                id: 1,
                firstName: "New",
            } as any);

            const result = await updateEmployee(1, { firstName: "New" });

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: expect.objectContaining({ firstName: "New" }),
                }),
            );
        });

        // Add more cases for email updates if needed
    });

    describe("deleteEmployee", () => {
        it("should fail if not found", async () => {
            prismaMock.employee.findUnique.mockResolvedValue(null);

            const result = await deleteEmployee(999);

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });

        it("should delete if found", async () => {
            prismaMock.employee.findUnique.mockResolvedValue({
                id: 1,
                firstName: "DeleteMe",
            } as any);

            const result = await deleteEmployee(1);

            expect(result.success).toBe(true);
            expect(prismaMock.employee.delete).toHaveBeenCalledWith({
                where: { id: 1 },
            });
        });
    });
});
