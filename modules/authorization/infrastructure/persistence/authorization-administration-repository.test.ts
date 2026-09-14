import { describe, expect, it, vi } from "vitest";

import type {
    AuthorizationAdministrationPersistenceContext,
} from "../../application/administration-types";
import { createAuthorizationAdministrationRepository } from "./authorization-administration-repository";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const UPDATED_AT = new Date("2026-01-02T00:00:00.000Z");

function userIdentity(id: number) {
    return {
        id,
        name: `User ${id}`,
        email: `user-${id}@example.com`,
        role: "USER",
        isActive: true,
        deletedAt: null,
        employee: {
            id: id + 1000,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            status: "ACTIVE",
            deletedAt: null,
        },
    };
}

function teamRow(id: number) {
    return {
        id,
        key: `team-${id}`,
        name: `Team ${id}`,
        description: null,
        isActive: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        _count: { roles: 1, memberships: 1, grants: 1 },
    };
}

function detailedTeamRow() {
    return {
        ...teamRow(10),
        roles: [{
            id: 20,
            teamId: 10,
            key: "member",
            name: "Member",
            isActive: false,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
            _count: { memberships: 1, grants: 1 },
            grants: [{ capabilityKey: "routine.task.read", scope: "ASSIGNED" }],
        }],
        memberships: [{
            teamId: 10,
            userId: 7,
            teamRoleId: 20,
            role: {
                id: 20,
                teamId: 10,
                key: "member",
                name: "Member",
                isActive: false,
            },
            user: userIdentity(7),
        }],
        grants: [{ capabilityKey: "routine.task.read", scope: "CREATED" }],
    };
}

function detailedUserRow() {
    return {
        ...userIdentity(7),
        teamMemberships: [{
            teamId: 10,
            userId: 7,
            teamRoleId: 20,
            team: {
                id: 10,
                key: "team-10",
                name: "Team 10",
                isActive: true,
            },
            role: {
                id: 20,
                teamId: 10,
                key: "member",
                name: "Member",
                isActive: false,
            },
        }],
        userCapabilityGrants: [{
            capabilityKey: "stock.request.create",
            scope: "OWN",
        }],
    };
}

describe("Authorization Administration persistence read adapter", () => {
    it("uses one bounded aggregate query for the Team list", async () => {
        const findMany = vi.fn(async () => [teamRow(10), teamRow(20)]);
        const context = {
            team: { findMany, findUnique: vi.fn() },
            user: { findUnique: vi.fn() },
        } as unknown as AuthorizationAdministrationPersistenceContext;
        const repository = createAuthorizationAdministrationRepository(context);

        await expect(repository.listTeams()).resolves.toMatchObject([
            { id: 10, roleCount: 1, membershipCount: 1, teamGrantCount: 1 },
            { id: 20, roleCount: 1, membershipCount: 1, teamGrantCount: 1 },
        ]);
        expect(findMany).toHaveBeenCalledTimes(1);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            orderBy: { key: "asc" },
            select: expect.objectContaining({
                id: true,
                _count: expect.objectContaining({
                    select: expect.objectContaining({
                        roles: true,
                        memberships: true,
                        grants: true,
                    }),
                }),
            }),
        }));
    });

    it("loads Team detail and its roles, memberships, and grants in one relation-shaped query", async () => {
        const findUnique = vi.fn(async () => detailedTeamRow());
        const context = {
            team: { findMany: vi.fn(), findUnique },
            user: { findUnique: vi.fn() },
        } as unknown as AuthorizationAdministrationPersistenceContext;
        const repository = createAuthorizationAdministrationRepository(context);

        const result = await repository.findTeamById(10);

        expect(result).toMatchObject({
            id: 10,
            roles: [{ id: 20, teamId: 10, isActive: false, grants: [{
                capabilityKey: "routine.task.read",
                scope: "ASSIGNED",
            }] }],
            memberships: [{ userId: 7, teamRoleId: 20 }],
            grants: [{ capabilityKey: "routine.task.read", scope: "CREATED" }],
        });
        expect(findUnique).toHaveBeenCalledTimes(1);
        expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 10 },
            select: expect.objectContaining({
                roles: expect.any(Object),
                memberships: expect.any(Object),
                grants: expect.any(Object),
            }),
        }));
    });

    it("loads User identity, workforce state, memberships, and direct grants without unrelated fields", async () => {
        const findUnique = vi.fn(async () => detailedUserRow());
        const context = {
            team: { findMany: vi.fn(), findUnique: vi.fn() },
            user: { findUnique },
        } as unknown as AuthorizationAdministrationPersistenceContext;
        const repository = createAuthorizationAdministrationRepository(context);

        const result = await repository.findUserById(7);

        expect(result).toMatchObject({
            id: 7,
            employee: { id: 1007, status: "ACTIVE" },
            teamMemberships: [{
                teamId: 10,
                teamRoleId: 20,
                role: { id: 20, teamId: 10 },
            }],
            userCapabilityGrants: [{
                capabilityKey: "stock.request.create",
                scope: "OWN",
            }],
        });
        expect(findUnique).toHaveBeenCalledTimes(1);
        expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 7 },
            select: expect.objectContaining({
                employee: expect.any(Object),
                teamMemberships: expect.any(Object),
                userCapabilityGrants: expect.any(Object),
            }),
        }));
    });
});
