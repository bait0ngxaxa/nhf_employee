import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

const {
    upsertTeamCapabilityGrantForSeedMock,
    upsertTeamForSeedMock,
    upsertTeamMembershipForSeedMock,
    upsertTeamRoleCapabilityGrantForSeedMock,
    upsertTeamRoleForSeedMock,
    upsertUserCapabilityGrantForSeedMock,
} = vi.hoisted(() => ({
    upsertTeamCapabilityGrantForSeedMock: vi.fn(),
    upsertTeamForSeedMock: vi.fn(),
    upsertTeamMembershipForSeedMock: vi.fn(),
    upsertTeamRoleCapabilityGrantForSeedMock: vi.fn(),
    upsertTeamRoleForSeedMock: vi.fn(),
    upsertUserCapabilityGrantForSeedMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<Prisma.TransactionClient>(),
}));

vi.mock("../infrastructure/persistence/authorization-repository", () => ({
    upsertTeamCapabilityGrantForSeed: upsertTeamCapabilityGrantForSeedMock,
    upsertTeamForSeed: upsertTeamForSeedMock,
    upsertTeamMembershipForSeed: upsertTeamMembershipForSeedMock,
    upsertTeamRoleCapabilityGrantForSeed: upsertTeamRoleCapabilityGrantForSeedMock,
    upsertTeamRoleForSeed: upsertTeamRoleForSeedMock,
    upsertUserCapabilityGrantForSeed: upsertUserCapabilityGrantForSeedMock,
}));

import {
    applyAuthorizationSeed,
    AUTHORIZATION_SEED_CONFIGURATION,
} from "./seed";
import type {
    AuthorizationPersistenceContext,
    AuthorizationSeedConfiguration,
} from "./types";

const persistenceContext = mockDeep<Prisma.TransactionClient>() as unknown as
    AuthorizationPersistenceContext;

describe("authorization seed boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        upsertTeamForSeedMock.mockResolvedValue({ id: 101 });
        upsertTeamRoleForSeedMock.mockResolvedValue({ id: 202 });
        upsertTeamMembershipForSeedMock.mockResolvedValue({});
        upsertTeamCapabilityGrantForSeedMock.mockResolvedValue({});
        upsertTeamRoleCapabilityGrantForSeedMock.mockResolvedValue({});
        upsertUserCapabilityGrantForSeedMock.mockResolvedValue({});
    });

    it("starts with no unapproved production Team policy", () => {
        expect(AUTHORIZATION_SEED_CONFIGURATION).toEqual({
            teams: [],
            roles: [],
            memberships: [],
            teamGrants: [],
            teamRoleGrants: [],
            userGrants: [],
        });
    });

    it("validates every configured grant before writing any seed record", async () => {
        const configuration: AuthorizationSeedConfiguration = {
            teams: [{ key: "team-a", name: "Team A" }],
            roles: [],
            memberships: [],
            teamGrants: [{
                teamKey: "team-a",
                capabilityKey: "stock.request.create",
                scope: "ALL",
            }],
            teamRoleGrants: [],
            userGrants: [],
        };

        await expect(
            applyAuthorizationSeed(configuration, persistenceContext),
        ).rejects.toMatchObject({ code: "UNSUPPORTED_SCOPE" });
        expect(upsertTeamForSeedMock).not.toHaveBeenCalled();
        expect(upsertTeamCapabilityGrantForSeedMock).not.toHaveBeenCalled();
    });

    it("upserts only explicit configuration in Team-scoped deterministic order", async () => {
        const configuration: AuthorizationSeedConfiguration = {
            teams: [{ key: "team-a", name: "Team A" }],
            roles: [{
                teamKey: "team-a",
                key: "member",
                name: "Member",
            }],
            memberships: [{
                teamKey: "team-a",
                userId: 7,
                teamRoleKey: "member",
            }],
            teamGrants: [{
                teamKey: "team-a",
                capabilityKey: "routine.task.read",
                scope: "ALL",
            }],
            teamRoleGrants: [{
                teamKey: "team-a",
                teamRoleKey: "member",
                capabilityKey: "routine.task.read",
                scope: "CREATED",
            }],
            userGrants: [{
                userId: 7,
                capabilityKey: "stock.request.create",
                scope: "OWN",
            }],
        };

        await expect(
            applyAuthorizationSeed(configuration, persistenceContext),
        ).resolves.toBeUndefined();

        expect(upsertTeamForSeedMock).toHaveBeenCalledWith(
            configuration.teams[0],
            persistenceContext,
        );
        expect(upsertTeamRoleForSeedMock).toHaveBeenCalledWith(
            101,
            configuration.roles[0],
            persistenceContext,
        );
        expect(upsertTeamMembershipForSeedMock).toHaveBeenCalledWith(
            101,
            configuration.memberships[0],
            202,
            persistenceContext,
        );
        expect(upsertTeamCapabilityGrantForSeedMock).toHaveBeenCalledWith(
            101,
            { capabilityKey: "routine.task.read", scope: "ALL" },
            persistenceContext,
        );
        expect(upsertTeamRoleCapabilityGrantForSeedMock).toHaveBeenCalledWith(
            202,
            { capabilityKey: "routine.task.read", scope: "CREATED" },
            persistenceContext,
        );
        expect(upsertUserCapabilityGrantForSeedMock).toHaveBeenCalledWith(
            7,
            { capabilityKey: "stock.request.create", scope: "OWN" },
            persistenceContext,
        );
    });
});
