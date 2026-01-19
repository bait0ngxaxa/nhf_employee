import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { importEmployeesFromCSV } from "@/lib/services/employee/import";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Employee Import", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    it("should import valid employees", async () => {
        // Arrange
        const mockDepts = [{ id: 1, code: "ADMIN", name: "Administration" }];
        prismaMock.department.findMany.mockResolvedValue(mockDepts as any);
        prismaMock.employee.findMany.mockResolvedValue([]); // No existing emails
        prismaMock.employee.create.mockImplementation((args) =>
            Promise.resolve({ ...args.data, dept: { name: "ADMIN" } } as any),
        );

        const csvData = [
            {
                firstName: "John",
                lastName: "Doe",
                position: "Dev",
                department: "ADMIN",
                email: "john@test.com",
            },
        ];

        // Act
        const result = await importEmployeesFromCSV(csvData);

        // Assert
        expect(result.success).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
        expect(prismaMock.employee.create).toHaveBeenCalled();
    });

    it("should report errors for missing fields", async () => {
        prismaMock.department.findMany.mockResolvedValue([]);
        prismaMock.employee.findMany.mockResolvedValue([]);

        const csvData = [
            { firstName: "", lastName: "Doe" }, // Missing fields
        ];

        const result = await importEmployeesFromCSV(csvData as any);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("เป็นข้อมูลที่จำเป็น");
    });

    it("should handle duplicate emails inside CSV or DB", async () => {
        prismaMock.department.findMany.mockResolvedValue([
            { id: 1, code: "ADMIN" },
        ] as any);
        prismaMock.employee.findMany.mockResolvedValue([
            { email: "taken@test.com" },
        ] as any);

        const csvData = [
            {
                firstName: "A",
                lastName: "B",
                position: "P",
                department: "ADMIN",
                email: "taken@test.com",
            },
            {
                firstName: "C",
                lastName: "D",
                position: "P",
                department: "ADMIN",
                email: "unique@test.com",
            },
        ];

        // Mock create only for successful one
        prismaMock.employee.create.mockResolvedValue({
            firstName: "C",
            dept: { name: "ADMIN" },
        } as any);

        const result = await importEmployeesFromCSV(csvData);

        expect(result.errors).toHaveLength(1); // duplicate
        expect(result.success).toHaveLength(1); // unique
        expect(result.errors[0].error).toContain("อีเมลนี้ถูกใช้งานแล้ว");
    });
});
