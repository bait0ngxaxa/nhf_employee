import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPersistenceContext } from "../../application/types";
import { createAuthorizationRecipientRepository } from "./authorization-recipient-repository";

describe("authorization recipient repository", () => {
    it("enumerates active users across all configured grant origins and deduplicates deterministically", async () => {
        const findMany = vi.fn().mockResolvedValue([
            { id: 11 },
            { id: 7 },
            { id: 11 },
        ]);
        const context = {
            user: { findMany },
        } as unknown as AuthorizationPersistenceContext;

        const repository = createAuthorizationRecipientRepository(context);
        await expect(repository.findActiveUsersWithConfiguredCapabilityScope({
            capability: "stock.request.process",
            scope: "ALL",
        })).resolves.toEqual([7, 11]);

        expect(findMany).toHaveBeenCalledWith({
            where: {
                isActive: true,
                deletedAt: null,
                OR: [
                    {
                        userCapabilityGrants: {
                            some: {
                                capabilityKey: "stock.request.process",
                                scope: "ALL",
                            },
                        },
                    },
                    {
                        teamMemberships: {
                            some: {
                                team: {
                                    is: {
                                        isActive: true,
                                        grants: {
                                            some: {
                                                capabilityKey: "stock.request.process",
                                                scope: "ALL",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    {
                        teamMemberships: {
                            some: {
                                team: { is: { isActive: true } },
                                role: {
                                    is: {
                                        isActive: true,
                                        team: { is: { isActive: true } },
                                        grants: {
                                            some: {
                                                capabilityKey: "stock.request.process",
                                                scope: "ALL",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            },
            select: { id: true },
            orderBy: { id: "asc" },
        });
    });

    it("does not infer recipient authority from the system role", async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const context = {
            user: { findMany },
        } as unknown as AuthorizationPersistenceContext;

        await expect(
            createAuthorizationRecipientRepository(context)
                .findActiveUsersWithConfiguredCapabilityScope({
                    capability: "routine.task.read",
                    scope: "ALL",
                }),
        ).resolves.toEqual([]);

        const query = findMany.mock.calls[0]?.[0];
        expect(query).not.toHaveProperty("where.role");
    });
});
