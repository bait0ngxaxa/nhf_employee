import { Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { authorizationRecipientLookup } from "@/modules/authorization";

const TEST_PREFIX = "phase13a-recipient";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function cleanFixtures(): Promise<void> {
    await prisma.userCapabilityGrant.deleteMany({
        where: { user: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamMembership.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamRoleCapabilityGrant.deleteMany({
        where: { teamRole: { team: { key: { startsWith: `${TEST_PREFIX}-` } } } },
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

async function createUser(
    label: string,
    role: Role = Role.USER,
): Promise<{ id: number }> {
    return prisma.user.create({
        data: {
            email: `${TEST_PREFIX}-${label}@integration.test`,
            name: `Phase 13A ${label}`,
            password: "integration-test-only",
            role,
        },
        select: { id: true },
    });
}

describe.sequential("Phase 13A configured notification recipient lookup", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanFixtures();
    });

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("leaves the Routine recipient enum in its role-neutral migrated form", async () => {
        const columns = await prisma.$queryRaw<Array<{ COLUMN_TYPE: string }>>`
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'routine_reminder_rules'
              AND COLUMN_NAME = 'recipientScope'
        `;

        expect(columns[0]?.COLUMN_TYPE).toContain("ALL_READERS");
        expect(columns[0]?.COLUMN_TYPE).toContain("ASSIGNEES_AND_ALL_READERS");
        expect(columns[0]?.COLUMN_TYPE).not.toContain("ADMINS");
    });

    it("resolves only active configured authority from Team, TeamRole, and User grants", async () => {
        const teamUser = await createUser("team");
        const roleUser = await createUser("team-role");
        const directUser = await createUser("direct");
        const duplicateUser = await createUser("duplicate");
        const wrongScopeUser = await createUser("wrong-scope");
        const wrongCapabilityUser = await createUser("wrong-capability");
        const inactiveTeamUser = await createUser("inactive-team");
        const inactiveRoleUser = await createUser("inactive-role");
        const invalidRelationUser = await createUser("invalid-relation");
        const inactiveUser = await createUser("inactive-user");
        const deletedUser = await createUser("deleted-user");
        const adminWithoutCapability = await createUser("admin-without-capability", Role.ADMIN);
        const emailAllUser = await createUser("email-all");
        const emailOwnUser = await createUser("email-own");
        const routineAllReaderUser = await createUser("routine-all-reader");
        const routineDefaultUser = await createUser("routine-default");

        const team = await prisma.team.create({
            data: {
                key: `${TEST_PREFIX}-team-source`,
                name: "Phase 13A Team source",
            },
        });
        const roleTeam = await prisma.team.create({
            data: {
                key: `${TEST_PREFIX}-role-source`,
                name: "Phase 13A TeamRole source",
            },
        });
        const inactiveTeam = await prisma.team.create({
            data: {
                key: `${TEST_PREFIX}-inactive-team`,
                name: "Phase 13A inactive Team",
                isActive: false,
            },
        });
        const invalidRelationTeam = await prisma.team.create({
            data: {
                key: `${TEST_PREFIX}-invalid-relation`,
                name: "Phase 13A invalid relation",
            },
        });
        const activeRole = await prisma.teamRole.create({
            data: {
                teamId: roleTeam.id,
                key: "processor",
                name: "Processor",
            },
        });
        const inactiveRole = await prisma.teamRole.create({
            data: {
                teamId: roleTeam.id,
                key: "inactive-processor",
                name: "Inactive processor",
                isActive: false,
            },
        });
        const invalidRelationRole = await prisma.teamRole.create({
            data: {
                teamId: invalidRelationTeam.id,
                key: "other-team-role",
                name: "Other Team role",
            },
        });

        await prisma.teamCapabilityGrant.create({
            data: {
                teamId: team.id,
                capabilityKey: "stock.request.process",
                scope: "ALL",
            },
        });
        await prisma.teamMembership.createMany({
            data: [
                { teamId: team.id, userId: teamUser.id },
                { teamId: team.id, userId: duplicateUser.id },
            ],
        });
        await prisma.teamRoleCapabilityGrant.create({
            data: {
                teamRoleId: activeRole.id,
                capabilityKey: "stock.request.process",
                scope: "ALL",
            },
        });
        await prisma.teamMembership.create({
            data: {
                teamId: roleTeam.id,
                userId: roleUser.id,
                teamRoleId: activeRole.id,
            },
        });
        await prisma.teamRoleCapabilityGrant.create({
            data: {
                teamRoleId: inactiveRole.id,
                capabilityKey: "stock.request.process",
                scope: "ALL",
            },
        });
        await prisma.teamMembership.create({
            data: {
                teamId: roleTeam.id,
                userId: inactiveRoleUser.id,
                teamRoleId: inactiveRole.id,
            },
        });
        await prisma.teamCapabilityGrant.create({
            data: {
                teamId: inactiveTeam.id,
                capabilityKey: "stock.request.process",
                scope: "ALL",
            },
        });
        await prisma.teamMembership.create({
            data: { teamId: inactiveTeam.id, userId: inactiveTeamUser.id },
        });
        await prisma.userCapabilityGrant.createMany({
            data: [
                {
                    userId: directUser.id,
                    capabilityKey: "stock.request.process",
                    scope: "ALL",
                },
                {
                    userId: duplicateUser.id,
                    capabilityKey: "stock.request.process",
                    scope: "ALL",
                },
                {
                    userId: wrongScopeUser.id,
                    capabilityKey: "stock.request.process",
                    scope: "OWN",
                },
                {
                    userId: wrongCapabilityUser.id,
                    capabilityKey: "stock.inventory.manage",
                    scope: "ALL",
                },
                {
                    userId: inactiveUser.id,
                    capabilityKey: "stock.request.process",
                    scope: "ALL",
                },
                {
                    userId: deletedUser.id,
                    capabilityKey: "stock.request.process",
                    scope: "ALL",
                },
                {
                    userId: emailAllUser.id,
                    capabilityKey: "email.request.read",
                    scope: "ALL",
                },
                {
                    userId: emailOwnUser.id,
                    capabilityKey: "email.request.read",
                    scope: "OWN",
                },
                {
                    userId: routineAllReaderUser.id,
                    capabilityKey: "routine.task.read",
                    scope: "ALL",
                },
            ],
        });
        await prisma.user.update({
            where: { id: inactiveUser.id },
            data: { isActive: false },
        });
        await prisma.user.update({
            where: { id: deletedUser.id },
            data: { deletedAt: new Date("2026-01-01T00:00:00.000Z") },
        });

        await expect(prisma.teamMembership.create({
            data: {
                teamId: roleTeam.id,
                userId: invalidRelationUser.id,
                teamRoleId: invalidRelationRole.id,
            },
        })).rejects.toBeDefined();

        const recipientIds = await authorizationRecipientLookup
            .findActiveUsersWithConfiguredCapabilityScope({
                capability: "stock.request.process",
                scope: "ALL",
            });

        expect(recipientIds).toEqual([
            teamUser.id,
            roleUser.id,
            directUser.id,
            duplicateUser.id,
        ].sort((left, right) => left - right));
        expect(recipientIds).not.toContain(adminWithoutCapability.id);
        expect(recipientIds).not.toContain(inactiveTeamUser.id);
        expect(recipientIds).not.toContain(inactiveRoleUser.id);
        expect(recipientIds).not.toContain(invalidRelationUser.id);
        expect(recipientIds).not.toContain(inactiveUser.id);
        expect(recipientIds).not.toContain(deletedUser.id);
        expect(recipientIds).not.toContain(wrongScopeUser.id);
        expect(recipientIds).not.toContain(wrongCapabilityUser.id);

        const emailReaderIds = await authorizationRecipientLookup
            .findActiveUsersWithConfiguredCapabilityScope({
                capability: "email.request.read",
                scope: "ALL",
            });
        expect(emailReaderIds).toEqual([emailAllUser.id]);
        expect(emailReaderIds).not.toContain(emailOwnUser.id);
        expect(emailReaderIds).not.toContain(adminWithoutCapability.id);
        const routineReaderIds = await authorizationRecipientLookup
            .findActiveUsersWithConfiguredCapabilityScope({
                capability: "routine.task.read",
                scope: "ALL",
            });
        expect(routineReaderIds).toEqual([routineAllReaderUser.id]);
        expect(routineReaderIds).not.toContain(routineDefaultUser.id);
    });
});
