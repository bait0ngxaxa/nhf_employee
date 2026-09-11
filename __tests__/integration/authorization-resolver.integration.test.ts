import { Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { authorization } from "@/modules/authorization";
import type { AuthorizationConfigurationError } from "@/modules/authorization";
import type { AuthorizationActor } from "@/modules/authorization";

const TEST_PREFIX = "phase3-authz";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function cleanAuthorizationFixtures(): Promise<void> {
    await prisma.userCapabilityGrant.deleteMany({
        where: { user: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamMembership.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamRoleCapabilityGrant.deleteMany({
        where: {
            teamRole: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
        },
    });
    await prisma.teamCapabilityGrant.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamRole.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.team.deleteMany({
        where: { key: { startsWith: `${TEST_PREFIX}-` } },
    });
    await prisma.user.deleteMany({
        where: { email: { startsWith: `${TEST_PREFIX}-` } },
    });
}

async function createUser(label: string): Promise<{ id: number }> {
    return prisma.user.create({
        data: {
            email: `${TEST_PREFIX}-${label}@integration.test`,
            name: `ผู้ใช้ทดสอบ ${label}`,
            password: "integration-test-only",
            role: Role.USER,
        },
        select: { id: true },
    });
}

async function createTeam(
    label: string,
    isActive: boolean = true,
): Promise<{ id: number }> {
    return prisma.team.create({
        data: {
            key: `${TEST_PREFIX}-${label}`,
            name: `ทีมทดสอบ ${label}`,
            isActive,
        },
        select: { id: true },
    });
}

function userActor(userId: number): AuthorizationActor {
    return {
        userId,
        employeeId: null,
        systemRole: "USER",
        channel: "DASHBOARD",
    };
}

describe.sequential("authorization resolver with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanAuthorizationFixtures();
    });

    afterAll(async () => {
        await cleanAuthorizationFixtures();
        await prisma.$disconnect();
    });

    it("resolves a Team grant through an active membership", async () => {
        const user = await createUser("team");
        const team = await createTeam("team");
        await prisma.teamMembership.create({
            data: { teamId: team.id, userId: user.id },
        });
        await prisma.teamCapabilityGrant.create({
            data: {
                teamId: team.id,
                capabilityKey: "routine.task.read",
                scope: "CREATED",
            },
        });

        const decision = await authorization.resolve(
            userActor(user.id),
            "routine.task.read",
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["CREATED"],
            grants: [{
                source: { type: "TEAM", teamId: team.id },
            }],
        });
    });

    it("resolves an active TeamRole grant through its membership", async () => {
        const user = await createUser("role");
        const team = await createTeam("role");
        const role = await prisma.teamRole.create({
            data: {
                teamId: team.id,
                key: "OPERATOR",
                name: "ผู้ปฏิบัติงาน",
            },
        });
        await prisma.teamMembership.create({
            data: {
                teamId: team.id,
                userId: user.id,
                teamRoleId: role.id,
            },
        });
        await prisma.teamRoleCapabilityGrant.create({
            data: {
                teamRoleId: role.id,
                capabilityKey: "routine.task.read",
                scope: "ASSIGNED",
            },
        });

        const decision = await authorization.resolve(
            userActor(user.id),
            "routine.task.read",
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["ASSIGNED"],
            grants: [{
                source: {
                    type: "TEAM_ROLE",
                    teamId: team.id,
                    teamRoleId: role.id,
                },
            }],
        });
    });

    it("resolves a direct User grant without a membership", async () => {
        const user = await createUser("direct");
        await prisma.userCapabilityGrant.create({
            data: {
                userId: user.id,
                capabilityKey: "stock.request.create",
                scope: "OWN",
            },
        });

        const decision = await authorization.resolve(
            userActor(user.id),
            "stock.request.create",
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["OWN"],
            grants: [{
                source: { type: "USER", userId: user.id },
            }],
        });
    });

    it("unions grants across multiple active Team memberships", async () => {
        const user = await createUser("multi-team");
        const firstTeam = await createTeam("multi-team-a");
        const secondTeam = await createTeam("multi-team-b");
        await prisma.teamMembership.createMany({
            data: [
                { teamId: firstTeam.id, userId: user.id },
                { teamId: secondTeam.id, userId: user.id },
            ],
        });
        await prisma.teamCapabilityGrant.createMany({
            data: [
                {
                    teamId: firstTeam.id,
                    capabilityKey: "routine.task.read",
                    scope: "CREATED",
                },
                {
                    teamId: secondTeam.id,
                    capabilityKey: "routine.task.read",
                    scope: "ASSIGNED",
                },
            ],
        });

        const decision = await authorization.resolve(
            userActor(user.id),
            "routine.task.read",
        );

        expect(decision.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(decision.grants.map((grant) => grant.source)).toEqual([
            { type: "TEAM", teamId: firstTeam.id },
            { type: "TEAM", teamId: secondTeam.id },
        ]);
    });

    it("excludes an inactive Team", async () => {
        const user = await createUser("inactive-team");
        const team = await createTeam("inactive-team", false);
        await prisma.teamMembership.create({
            data: { teamId: team.id, userId: user.id },
        });
        await prisma.teamCapabilityGrant.create({
            data: {
                teamId: team.id,
                capabilityKey: "routine.task.read",
                scope: "ALL",
            },
        });

        const decision = await authorization.resolve(
            userActor(user.id),
            "routine.task.read",
        );

        expect(decision).toMatchObject({
            allowed: false,
            scopes: [],
            grants: [],
            reason: "NO_APPLICABLE_GRANT",
        });
    });

    it("excludes an inactive TeamRole but retains Team grants", async () => {
        const user = await createUser("inactive-role");
        const team = await createTeam("inactive-role");
        const role = await prisma.teamRole.create({
            data: {
                teamId: team.id,
                key: "ARCHIVED_OPERATOR",
                name: "ผู้ปฏิบัติงานเดิม",
                isActive: false,
            },
        });
        await prisma.teamMembership.create({
            data: {
                teamId: team.id,
                userId: user.id,
                teamRoleId: role.id,
            },
        });
        await prisma.teamCapabilityGrant.create({
            data: {
                teamId: team.id,
                capabilityKey: "routine.task.read",
                scope: "CREATED",
            },
        });
        await prisma.teamRoleCapabilityGrant.create({
            data: {
                teamRoleId: role.id,
                capabilityKey: "routine.task.read",
                scope: "ASSIGNED",
            },
        });

        const decision = await authorization.resolve(
            userActor(user.id),
            "routine.task.read",
        );

        expect(decision.scopes).toEqual(["CREATED"]);
        expect(decision.grants).toHaveLength(1);
        expect(decision.grants[0]?.source).toEqual({
            type: "TEAM",
            teamId: team.id,
        });
    });

    it("fails closed when real persisted configuration has an unsupported scope", async () => {
        const user = await createUser("corrupt-scope");
        const team = await createTeam("corrupt-scope");
        await prisma.teamMembership.create({
            data: { teamId: team.id, userId: user.id },
        });
        await prisma.teamCapabilityGrant.create({
            data: {
                teamId: team.id,
                capabilityKey: "routine.task.read",
                scope: "OWN",
            },
        });

        await expect(
            authorization.resolve(userActor(user.id), "routine.task.read"),
        ).rejects.toMatchObject({
            name: "AuthorizationConfigurationError",
            code: "UNSUPPORTED_PERSISTED_SCOPE",
        } satisfies Partial<AuthorizationConfigurationError>);
    });
});
