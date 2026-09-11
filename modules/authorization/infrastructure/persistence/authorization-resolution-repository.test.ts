import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPersistenceContext } from "../../application/types";
import { createAuthorizationResolutionRepository } from "./authorization-resolution-repository";

describe("authorization resolution repository", () => {
    it("loads multiple capability grants with one bounded query per delegate", async () => {
        const capabilityKeys = [
            "routine.task.read",
            "routine.task.create",
        ];
        const userCapabilityGrantFindMany = vi.fn().mockResolvedValue([]);
        const teamMembershipFindMany = vi.fn().mockResolvedValue([{
            userId: 7,
            teamId: 10,
            teamRoleId: 20,
            team: {
                isActive: true,
                grants: [],
            },
            role: {
                id: 20,
                isActive: true,
            },
        }]);
        const teamRoleCapabilityGrantFindMany = vi.fn().mockResolvedValue([]);
        const context = {
            userCapabilityGrant: {
                findMany: userCapabilityGrantFindMany,
            },
            teamMembership: {
                findMany: teamMembershipFindMany,
            },
            teamRoleCapabilityGrant: {
                findMany: teamRoleCapabilityGrantFindMany,
            },
        } as unknown as AuthorizationPersistenceContext;

        const repository = createAuthorizationResolutionRepository(context);

        await repository.loadMany({ userId: 7, capabilityKeys });

        expect(userCapabilityGrantFindMany).toHaveBeenCalledTimes(1);
        expect(teamMembershipFindMany).toHaveBeenCalledTimes(1);
        expect(teamRoleCapabilityGrantFindMany).toHaveBeenCalledTimes(1);
        expect(userCapabilityGrantFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId: 7,
                    capabilityKey: { in: capabilityKeys },
                },
            }),
        );
        expect(teamMembershipFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                select: expect.objectContaining({
                    team: expect.objectContaining({
                        select: expect.objectContaining({
                            grants: expect.objectContaining({
                                where: { capabilityKey: { in: capabilityKeys } },
                            }),
                        }),
                    }),
                }),
            }),
        );
        expect(teamRoleCapabilityGrantFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    capabilityKey: { in: capabilityKeys },
                }),
            }),
        );
    });

    it("does not query role grants when the membership snapshot has no active role", async () => {
        const teamRoleCapabilityGrantFindMany = vi.fn().mockResolvedValue([]);
        const context = {
            userCapabilityGrant: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            teamMembership: {
                findMany: vi.fn().mockResolvedValue([{
                    userId: 7,
                    teamId: 10,
                    teamRoleId: null,
                    team: {
                        isActive: true,
                        grants: [],
                    },
                    role: null,
                }]),
            },
            teamRoleCapabilityGrant: {
                findMany: teamRoleCapabilityGrantFindMany,
            },
        } as unknown as AuthorizationPersistenceContext;

        const repository = createAuthorizationResolutionRepository(context);

        await repository.loadMany({
            userId: 7,
            capabilityKeys: ["routine.task.read", "routine.task.create"],
        });

        expect(teamRoleCapabilityGrantFindMany).not.toHaveBeenCalled();
    });
});
