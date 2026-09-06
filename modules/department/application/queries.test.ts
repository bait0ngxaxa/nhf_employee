import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { listDepartmentReferences, listDepartments } from "./queries";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const DEPARTMENTS = [
    {
        id: 2,
        name: "วิชาการ",
        code: "ACADEMIC",
        description: "Academic department",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    },
    {
        id: 1,
        name: "บริหาร",
        code: "ADMIN",
        description: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
];

describe("Department server queries", () => {
    beforeEach(() => mockReset(prismaMock));

    it("returns complete Department records ordered by name ascending", async () => {
        prismaMock.department.findMany.mockResolvedValue(DEPARTMENTS as never);

        await expect(listDepartments()).resolves.toEqual(DEPARTMENTS);
        expect(prismaMock.department.findMany).toHaveBeenCalledWith({
            orderBy: { name: "asc" },
        });
    });

    it("returns only the reference fields needed by Employee import", async () => {
        const references = DEPARTMENTS.map(({ id, code }) => ({ id, code }));
        prismaMock.department.findMany.mockResolvedValue(references as never);

        await expect(listDepartmentReferences()).resolves.toEqual(references);
        expect(prismaMock.department.findMany).toHaveBeenCalledWith({
            select: { id: true, code: true },
        });
    });

    it("propagates database errors to the application boundary", async () => {
        const databaseError = new Error("database details");
        prismaMock.department.findMany.mockRejectedValue(databaseError);

        await expect(listDepartments()).rejects.toBe(databaseError);
    });
});
