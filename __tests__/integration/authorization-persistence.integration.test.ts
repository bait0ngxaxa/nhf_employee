import { Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";

const TEST_PREFIX = "phase2-authz";

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

async function createTeam(label: string): Promise<{ id: number }> {
    return prisma.team.create({
        data: {
            key: `${TEST_PREFIX}-${label}`,
            name: `ทีมทดสอบ ${label}`,
        },
        select: { id: true },
    });
}

async function expectPrismaCode(
    operation: () => Promise<unknown>,
    code: string,
): Promise<void> {
    await expect(operation()).rejects.toMatchObject({ code });
}

describe.sequential("authorization persistence with real MySQL", () => {
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

    it("keeps Team keys unique and TeamRole keys unique only within a Team", async () => {
        const firstTeam = await createTeam("scoped-a");
        const secondTeam = await createTeam("scoped-b");

        await prisma.teamRole.create({
            data: { teamId: firstTeam.id, key: "HEAD", name: "หัวหน้าทีม" },
        });
        await prisma.teamRole.create({
            data: { teamId: secondTeam.id, key: "HEAD", name: "หัวหน้าทีม" },
        });

        await expectPrismaCode(
            () => prisma.teamRole.create({
                data: { teamId: firstTeam.id, key: "HEAD", name: "ซ้ำ" },
            }),
            "P2002",
        );
        await expectPrismaCode(
            () => prisma.team.create({
                data: {
                    key: `${TEST_PREFIX}-scoped-a`,
                    name: "ทีมซ้ำ",
                },
            }),
            "P2002",
        );
    });

    it("prevents duplicate memberships and cross-Team role assignment", async () => {
        const user = await createUser("membership");
        const firstTeam = await createTeam("membership-a");
        const secondTeam = await createTeam("membership-b");
        const firstRole = await prisma.teamRole.create({
            data: {
                teamId: firstTeam.id,
                key: "MEMBER",
                name: "สมาชิกทีมแรก",
            },
        });
        const secondRole = await prisma.teamRole.create({
            data: {
                teamId: secondTeam.id,
                key: "MEMBER",
                name: "สมาชิกทีมสอง",
            },
        });

        await prisma.teamMembership.create({
            data: {
                teamId: firstTeam.id,
                userId: user.id,
                teamRoleId: firstRole.id,
            },
        });
        await expectPrismaCode(
            () => prisma.teamMembership.create({
                data: {
                    teamId: firstTeam.id,
                    userId: user.id,
                    teamRoleId: firstRole.id,
                },
            }),
            "P2002",
        );
        await expectPrismaCode(
            () => prisma.teamMembership.update({
                where: {
                    teamId_userId: {
                        teamId: firstTeam.id,
                        userId: user.id,
                    },
                },
                data: { teamRoleId: secondRole.id },
            }),
            "P2003",
        );
    });

    it("prevents duplicate grants while allowing multiple registry-supported scopes", async () => {
        const user = await createUser("grants");
        const team = await createTeam("grants");
        const role = await prisma.teamRole.create({
            data: { teamId: team.id, key: "MEMBER", name: "สมาชิก" },
        });

        const teamGrant = {
            teamId: team.id,
            capabilityKey: "routine.task.read",
            scope: "ASSIGNED",
        };
        await prisma.teamCapabilityGrant.create({ data: teamGrant });
        await prisma.teamCapabilityGrant.create({
            data: { ...teamGrant, scope: "CREATED" },
        });
        await expectPrismaCode(
            () => prisma.teamCapabilityGrant.create({ data: teamGrant }),
            "P2002",
        );

        const roleGrant = {
            teamRoleId: role.id,
            capabilityKey: "routine.task.read",
            scope: "ASSIGNED",
        };
        await prisma.teamRoleCapabilityGrant.create({ data: roleGrant });
        await expectPrismaCode(
            () => prisma.teamRoleCapabilityGrant.create({ data: roleGrant }),
            "P2002",
        );

        const userGrant = {
            userId: user.id,
            capabilityKey: "stock.request.create",
            scope: "OWN",
        };
        await prisma.userCapabilityGrant.create({ data: userGrant });
        await expectPrismaCode(
            () => prisma.userCapabilityGrant.create({ data: userGrant }),
            "P2002",
        );
    });

    it("enforces foreign keys and conservative hard-delete behavior", async () => {
        const team = await createTeam("foreign-keys");
        const user = await createUser("foreign-keys");

        await expectPrismaCode(
            () => prisma.teamRole.create({
                data: { teamId: 999_999_999, key: "MISSING", name: "ไม่มีทีม" },
            }),
            "P2003",
        );
        await expectPrismaCode(
            () => prisma.teamMembership.create({
                data: { teamId: team.id, userId: 999_999_999 },
            }),
            "P2003",
        );
        await expectPrismaCode(
            () => prisma.teamCapabilityGrant.create({
                data: {
                    teamId: 999_999_999,
                    capabilityKey: "routine.task.read",
                    scope: "ALL",
                },
            }),
            "P2003",
        );
        await expectPrismaCode(
            () => prisma.teamRoleCapabilityGrant.create({
                data: {
                    teamRoleId: 999_999_999,
                    capabilityKey: "routine.task.read",
                    scope: "ALL",
                },
            }),
            "P2003",
        );
        await expectPrismaCode(
            () => prisma.userCapabilityGrant.create({
                data: {
                    userId: 999_999_999,
                    capabilityKey: "stock.request.create",
                    scope: "OWN",
                },
            }),
            "P2003",
        );

        await prisma.teamMembership.create({
            data: { teamId: team.id, userId: user.id },
        });
        await expectPrismaCode(
            () => prisma.team.delete({ where: { id: team.id } }),
            "P2003",
        );
    });
});
