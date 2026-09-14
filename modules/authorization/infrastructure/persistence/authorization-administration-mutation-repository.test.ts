import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createAuthorizationAdministrationMutationRepository } from "./authorization-administration-mutation-repository";

describe("Authorization Administration mutation persistence adapter", () => {
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
