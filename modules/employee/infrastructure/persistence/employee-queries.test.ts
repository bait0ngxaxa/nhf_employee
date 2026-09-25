import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    createEmployeeWhereClause,
    findCurrentEmployeeDisplayProjections,
    findCurrentEmployeeProjection,
    getEmployeeStats,
    hasEligibleCurrentEmployeeForUser,
} from "./employee-queries";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe("Employee query compatibility", () => {
    beforeEach(() => mockReset(prismaMock));

    it("checks legacy API eligibility with only the linked active Employee", async () => {
        prismaMock.employee.findFirst.mockResolvedValueOnce({ id: 101 } as never);

        await expect(hasEligibleCurrentEmployeeForUser(41)).resolves.toBe(true);
        expect(prismaMock.employee.findFirst).toHaveBeenCalledWith({
            where: {
                user: { id: 41 },
                status: "ACTIVE",
                deletedAt: null,
            },
            select: { id: true },
        });

        prismaMock.employee.findFirst.mockResolvedValueOnce(null);

        await expect(hasEligibleCurrentEmployeeForUser(41)).resolves.toBe(false);
    });

    it("excludes soft-deleted and bootstrap-admin Employees from list queries", () => {
        expect(createEmployeeWhereClause({ page: 1, limit: 10 })).toMatchObject({
            deletedAt: null,
            NOT: { email: "admin@thainhf.org" },
        });
    });

    it("intentionally counts stats without soft-delete filters", async () => {
        prismaMock.employee.count
            .mockResolvedValueOnce(9)
            .mockResolvedValueOnce(4)
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(5)
            .mockResolvedValueOnce(4);

        await expect(getEmployeeStats()).resolves.toEqual({
            total: 9,
            active: 4,
            inactive: 3,
            suspended: 2,
            admin: 5,
            academic: 4,
        });
        expect(prismaMock.employee.count).toHaveBeenNthCalledWith(1);
        expect(prismaMock.employee.count).toHaveBeenNthCalledWith(2, { where: { status: "ACTIVE" } });
        expect(prismaMock.employee.count).toHaveBeenNthCalledWith(5, { where: { dept: { code: "ADMIN" } } });
    });

    it("returns the Employee-owned current identity, department, and hierarchy projection", async () => {
        prismaMock.employee.findFirst.mockResolvedValue({
            id: 101,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            status: "ACTIVE",
            deletedAt: null,
            dept: { name: "วิชาการ" },
            subordinates: [{ id: 202 }],
        } as never);

        await expect(findCurrentEmployeeProjection(41)).resolves.toEqual({
            id: 101,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            departmentName: "วิชาการ",
            isManager: true,
        });
        expect(prismaMock.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                user: { id: 41, isActive: true, deletedAt: null },
            },
        }));
    });

    it("does not project an inactive or deleted Employee", async () => {
        prismaMock.employee.findFirst.mockResolvedValue({
            id: 101,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            status: "SUSPENDED",
            deletedAt: null,
            dept: { name: "วิชาการ" },
            subordinates: [],
        } as never);

        await expect(findCurrentEmployeeProjection(41)).resolves.toBeNull();
    });

    it("returns only active workforce identity fields for requested users", async () => {
        prismaMock.employee.findMany.mockResolvedValueOnce([{
            id: 101,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            user: { id: 41 },
        }] as never);

        await expect(findCurrentEmployeeDisplayProjections([41, 41, 42])).resolves.toEqual([
            {
                userId: 41,
                employeeId: 101,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: "ชาย",
            },
        ]);
        expect(prismaMock.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                user: { id: { in: [41, 42] }, isActive: true, deletedAt: null },
            },
            select: expect.objectContaining({
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                user: { select: { id: true } },
            }),
        }));
    });
});
