import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";

import { findActiveUserTeams } from "./user-team-queries";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe("current user Team presentation query", () => {
    beforeEach(() => mockReset(prismaMock));

    it("returns active Teams in deterministic order without authorization details", async () => {
        prismaMock.teamMembership.findMany.mockResolvedValue([
            { team: { id: 3, name: "การเงิน" } },
            { team: { id: 8, name: "IT" } },
        ] as never);

        await expect(findActiveUserTeams(41)).resolves.toEqual([
            { id: 3, name: "การเงิน" },
            { id: 8, name: "IT" },
        ]);
        expect(prismaMock.teamMembership.findMany).toHaveBeenCalledWith({
            where: { userId: 41, team: { isActive: true } },
            orderBy: [
                { team: { name: "asc" } },
                { teamId: "asc" },
            ],
            select: { team: { select: { id: true, name: true } } },
        });
    });

    it("deduplicates repeated Team rows defensively", async () => {
        prismaMock.teamMembership.findMany.mockResolvedValue([
            { team: { id: 3, name: "การเงิน" } },
            { team: { id: 3, name: "การเงิน" } },
        ] as never);

        await expect(findActiveUserTeams(41)).resolves.toEqual([
            { id: 3, name: "การเงิน" },
        ]);
    });

    it("returns no Teams when there are no active memberships", async () => {
        prismaMock.teamMembership.findMany.mockResolvedValue([]);

        await expect(findActiveUserTeams(41)).resolves.toEqual([]);
    });
});
