import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPersistenceContext } from "../../application/types";
import { createAuthorizationRecipientRepository } from "./authorization-recipient-repository";

describe("authorization recipient repository", () => {
    it("loads active users and configured resolution data without using system roles", async () => {
        const userFindMany = vi.fn().mockResolvedValue([
            { id: 11 },
            { id: 7 },
            { id: 11 },
        ]);
        const userCapabilityGrantFindMany = vi.fn().mockResolvedValue([
            {
                userId: 7,
                capabilityKey: "stock.request.process",
                scope: "ALL",
            },
        ]);
        const teamMembershipFindMany = vi.fn().mockResolvedValue([]);
        const teamRoleCapabilityGrantFindMany = vi.fn();
        const context = {
            user: { findMany: userFindMany },
            userCapabilityGrant: { findMany: userCapabilityGrantFindMany },
            teamMembership: { findMany: teamMembershipFindMany },
            teamRoleCapabilityGrant: {
                findMany: teamRoleCapabilityGrantFindMany,
            },
        } as unknown as AuthorizationPersistenceContext;

        const repository = createAuthorizationRecipientRepository(context);
        const candidates = await repository.loadActiveUsersWithConfiguredCapability({
            capability: "stock.request.process",
            scope: "ALL",
        });

        expect(candidates).toEqual([
            {
                userId: 7,
                resolutionData: {
                    userGrants: [{
                        userId: 7,
                        capabilityKey: "stock.request.process",
                        scope: "ALL",
                    }],
                    memberships: [],
                    teamRoleGrants: [],
                },
            },
        ]);
        expect(userFindMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                isActive: true,
                deletedAt: null,
                OR: expect.arrayContaining([
                    expect.objectContaining({
                        userCapabilityGrants: {
                            some: {
                                capabilityKey: "stock.request.process",
                                scope: "ALL",
                            },
                        },
                    }),
                ]),
            }),
            select: { id: true },
            orderBy: { id: "asc" },
        });
        const userQuery = userFindMany.mock.calls[0]?.[0];
        expect(userQuery).not.toHaveProperty("where.role");
        expect(teamRoleCapabilityGrantFindMany).not.toHaveBeenCalled();
    });

    it("loads all persisted scopes for a capability so malformed mixed grants reach the evaluator", async () => {
        const userFindMany = vi.fn().mockResolvedValue([{ id: 7 }]);
        const userCapabilityGrantFindMany = vi.fn().mockResolvedValue([
            {
                userId: 7,
                capabilityKey: "stock.request.process",
                scope: "ALL",
            },
            {
                userId: 7,
                capabilityKey: "stock.request.process",
                scope: "OWN",
            },
        ]);
        const context = {
            user: { findMany: userFindMany },
            userCapabilityGrant: { findMany: userCapabilityGrantFindMany },
            teamMembership: { findMany: vi.fn().mockResolvedValue([]) },
            teamRoleCapabilityGrant: { findMany: vi.fn() },
        } as unknown as AuthorizationPersistenceContext;

        const candidates = await createAuthorizationRecipientRepository(context)
            .loadActiveUsersWithConfiguredCapability({
                capability: "stock.request.process",
                scope: "ALL",
            });

        expect(candidates[0]?.resolutionData.userGrants).toHaveLength(2);
        expect(userCapabilityGrantFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId: 7,
                    capabilityKey: "stock.request.process",
                },
            }),
        );
    });
});
