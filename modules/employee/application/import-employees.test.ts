import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { listDepartmentReferences } from "@/modules/department";
import {
    importEmployeesFromCsvRows,
} from "./import-employees";
import type { CsvImportEmployee } from "./types";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/modules/department", () => ({
    listDepartmentReferences: vi.fn(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Employee Import", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(listDepartmentReferences).mockReset();
    });

    it("should import valid employees", async () => {
        // Arrange
        const mockDepts = [{ id: 1, code: "ADMIN", name: "Administration" }];
        vi.mocked(listDepartmentReferences).mockResolvedValue(mockDepts);
        prismaMock.employee.findMany.mockResolvedValue([]); // No existing emails
        prismaMock.employee.create.mockImplementation((args) =>
            Promise.resolve({
                ...args.data,
                departmentId: 1,
                dept: { name: "ADMIN" },
                user: null,
            }) as never);

        const csvData: Partial<CsvImportEmployee>[] = [
            {
                firstName: "John",
                lastName: "Doe",
                position: "Dev",
                department: "ADMIN",
                email: "john@thainhf.org",
            },
        ];

        // Act
        const result = await importEmployeesFromCsvRows(csvData);

        // Assert
        expect(result.success).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
        expect(prismaMock.employee.create).toHaveBeenCalled();
        expect(listDepartmentReferences).toHaveBeenCalledTimes(1);
    });

    it("should report errors for missing fields", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([]);
        prismaMock.employee.findMany.mockResolvedValue([]);

        const csvData: Partial<CsvImportEmployee>[] = [
            { firstName: "", lastName: "Doe" }, // Missing fields
        ];

        const result = await importEmployeesFromCsvRows(csvData);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("เป็นข้อมูลที่จำเป็น");
    });

    it("should handle duplicate emails inside CSV or DB", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([
            { email: "taken@thainhf.org", firstName: "A", lastName: "B" },
        ] as never);

        const csvData = [
            {
                firstName: "A",
                lastName: "B",
                position: "P",
                department: "ADMIN",
                email: "taken@thainhf.org",
            },
            {
                firstName: "C",
                lastName: "D",
                position: "P",
                department: "ADMIN",
                email: "unique@thainhf.org",
            },
        ];

        // Mock create only for successful one
        prismaMock.employee.create.mockResolvedValue({
            firstName: "C",
            departmentId: 1,
            dept: { name: "ADMIN" },
            user: null,
        } as never);

        const result = await importEmployeesFromCsvRows(csvData);

        expect(result.errors).toHaveLength(1); // duplicate
        expect(result.success).toHaveLength(1); // unique
        expect(result.errors[0].error).toContain("อีเมลนี้ถูกใช้งานแล้ว");
    });

    it("should handle duplicate names inside DB", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([
            {
                email: "some@thainhf.org",
                firstName: "Duplicate",
                lastName: "Name",
            },
        ] as never);

        const csvData = [
            {
                firstName: "Duplicate ",
                lastName: " Name",
                position: "P",
                department: "ADMIN",
                email: "", // Empty email triggering temp email, but name matches
            },
        ];

        const result = await importEmployeesFromCsvRows(csvData);

        expect(result.errors).toHaveLength(1); // duplicate name
        expect(result.success).toHaveLength(0);
        expect(result.errors[0].error).toContain("มีอยู่ในระบบแล้ว");
    });

    it("accounts for every row in a mixed valid and invalid file", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN", name: "Administration" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([]);
        prismaMock.employee.create.mockImplementation((args) =>
            Promise.resolve({
                ...args.data,
                dept: { name: "ADMIN" },
            }) as never);

        const validRows: Partial<CsvImportEmployee>[] = Array.from(
            { length: 8 },
            (_, index) => ({
                firstName: `Valid${index}`,
                lastName: "Employee",
                position: "Developer",
                department: "ADMIN",
                email: `valid${index}@thainhf.org`,
            }),
        );
        const rows: Partial<CsvImportEmployee>[] = [
            ...validRows,
            {
                firstName: "Missing",
                lastName: "Position",
                department: "ADMIN",
            },
            {
                firstName: "External",
                lastName: "Email",
                position: "Developer",
                department: "ADMIN",
                email: "external@gmail.com",
            },
        ];

        const result = await importEmployeesFromCsvRows(rows);

        expect(result.success).toHaveLength(8);
        expect(result.errors).toHaveLength(2);
        expect(result.success.length + result.errors.length).toBe(10);
    });

    it("rejects an external email", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([]);

        const result = await importEmployeesFromCsvRows([{
            firstName: "External",
            lastName: "Email",
            position: "Developer",
            department: "ADMIN",
            email: "external@company.com",
        }]);

        expect(result.success).toHaveLength(0);
        expect(result.errors[0]?.error).toContain("@thainhf.org");
        expect(prismaMock.employee.create).not.toHaveBeenCalled();
    });

    it("normalizes an uppercase organizational email", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN", name: "Administration" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([]);
        prismaMock.employee.create.mockImplementation((args) =>
            Promise.resolve({
                ...args.data,
                dept: { name: "ADMIN" },
            }) as never);

        const result = await importEmployeesFromCsvRows([{
            firstName: "Uppercase",
            lastName: "Email",
            position: "Developer",
            department: "ADMIN",
            email: "USER@THAINHF.ORG",
        }]);

        expect(result.errors).toHaveLength(0);
        expect(prismaMock.employee.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ email: "user@thainhf.org" }),
            }),
        );
    });

    it.each(["", "-"])(
        "uses a temporary email when the source email is %j",
        async (email) => {
            vi.mocked(listDepartmentReferences).mockResolvedValue([
                { id: 1, code: "ADMIN", name: "Administration" },
            ] as never);
            prismaMock.employee.findMany.mockResolvedValue([]);
            prismaMock.employee.create.mockImplementation((args) =>
                Promise.resolve({
                    ...args.data,
                    dept: { name: "ADMIN" },
                }) as never);

            const result = await importEmployeesFromCsvRows([{
                firstName: "No",
                lastName: `Email${email || "Blank"}`,
                position: "Developer",
                department: "ADMIN",
                email,
            }]);

            expect(result.errors).toHaveLength(0);
            expect(prismaMock.employee.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        email: expect.stringMatching(/@temp\.local$/),
                    }),
                }),
            );
        },
    );

    it("rejects an unknown non-empty status", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([]);

        const result = await importEmployeesFromCsvRows([{
            firstName: "Unknown",
            lastName: "Status",
            position: "Developer",
            department: "ADMIN",
            status: "inactiv",
        }]);

        expect(result.success).toHaveLength(0);
        expect(result.errors[0]?.error).toContain("สถานะ");
    });

    it.each([
        ["", "ACTIVE"],
        ["active", "ACTIVE"],
        ["ปกติ", "ACTIVE"],
        ["inactive", "INACTIVE"],
        ["ลาออก", "INACTIVE"],
        ["suspended", "SUSPENDED"],
    ])("maps import status %j to %s on the server", async (status, expected) => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN", name: "Administration" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([]);
        prismaMock.employee.create.mockImplementation((args) =>
            Promise.resolve({
                ...args.data,
                dept: { name: "ADMIN" },
            }) as never);

        const result = await importEmployeesFromCsvRows([{
            firstName: "Status",
            lastName: "Mapping",
            position: "Developer",
            department: "ADMIN",
            status,
        }]);

        expect(result.errors).toHaveLength(0);
        expect(prismaMock.employee.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: expected }),
            }),
        );
    });

    it("continues to reject duplicate emails within the same file", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([
            { id: 1, code: "ADMIN", name: "Administration" },
        ] as never);
        prismaMock.employee.findMany.mockResolvedValue([]);
        prismaMock.employee.create.mockImplementation((args) =>
            Promise.resolve({
                ...args.data,
                dept: { name: "ADMIN" },
            }) as never);

        const result = await importEmployeesFromCsvRows([
            {
                firstName: "First",
                lastName: "Employee",
                position: "Developer",
                department: "ADMIN",
                email: "duplicate@thainhf.org",
            },
            {
                firstName: "Second",
                lastName: "Employee",
                position: "Developer",
                department: "ADMIN",
                email: "DUPLICATE@THAINHF.ORG",
            },
        ]);

        expect(result.success).toHaveLength(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.error).toContain("อีเมลนี้ถูกใช้งานแล้ว");
    });

    it("retains the historical application behavior without a 1000-row guard", async () => {
        vi.mocked(listDepartmentReferences).mockResolvedValue([]);
        prismaMock.employee.findMany.mockResolvedValue([]);
        const rows = Array.from({ length: 1001 }, () => ({
            firstName: "Missing",
            lastName: "Position",
        }));

        const result = await importEmployeesFromCsvRows(rows);

        expect(result.errors).toHaveLength(1001);
        expect(prismaMock.employee.create).not.toHaveBeenCalled();
    });
});
