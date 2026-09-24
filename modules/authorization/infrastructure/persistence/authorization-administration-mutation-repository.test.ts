import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const findActorEmployeeIdHint = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: { user: { findUnique: findActorEmployeeIdHint } },
}));

import { createAuthorizationAdministrationMutationRepository } from "./authorization-administration-mutation-repository";

describe("Authorization Administration mutation persistence adapter", () => {
    it("uses a persisted Employee ID only as a pre-transaction lock hint", async () => {
        const findUnique = vi.fn().mockResolvedValue({ employeeId: 21 });
        findActorEmployeeIdHint.mockResolvedValue({ employeeId: 21 });
        const tx = { user: { findUnique } } as unknown as Prisma.TransactionClient;
        const repository = createAuthorizationAdministrationMutationRepository();

        await expect(repository.findActorEmployeeIdLockHint(1)).resolves.toBe(21);
        await expect(repository.findActorEmployeeId(tx, 1)).resolves.toBe(21);
        expect(findActorEmployeeIdHint).toHaveBeenCalledWith({
            where: { id: 1 },
            select: { employeeId: true },
        });
        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 1 },
            select: { employeeId: true },
        });
    });

    it("loads only persisted actor authority and workforce lifecycle fields", async () => {
        const actor = {
            id: 1,
            role: "ADMIN",
            isActive: true,
            deletedAt: null,
            employee: { id: 21, status: "ACTIVE", deletedAt: null },
        };
        const findUnique = vi.fn().mockResolvedValue(actor);
        const tx = { user: { findUnique } } as unknown as Prisma.TransactionClient;
        const repository = createAuthorizationAdministrationMutationRepository();

        await expect(repository.findActorStateById(tx, actor.id)).resolves.toEqual(actor);
        expect(findUnique).toHaveBeenCalledWith({
            where: { id: actor.id },
            select: {
                id: true,
                role: true,
                isActive: true,
                deletedAt: true,
                employee: {
                    select: { id: true, status: true, deletedAt: true },
                },
            },
        });
    });

    it("loads TeamRole lifecycle impact grants only from active roles with members", async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const tx = {
            teamRoleCapabilityGrant: { findMany },
        } as unknown as Prisma.TransactionClient;
        const repository = createAuthorizationAdministrationMutationRepository();

        await repository.listTeamRoleGrantsForTeam(tx, 10);

        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                teamRole: {
                    is: {
                        teamId: 10,
                        isActive: true,
                        memberships: { some: { teamId: 10 } },
                    },
                },
            },
        }));
    });
});
