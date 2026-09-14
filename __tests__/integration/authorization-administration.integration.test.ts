import { Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getAuditLogs } from "@/modules/audit";
import {
    addAuthorizationAdministrationTeamGrant,
    addAuthorizationAdministrationTeamMember,
    addAuthorizationAdministrationTeamRoleGrant,
    addAuthorizationAdministrationUserGrant,
    createAuthorizationAdministrationTeam,
    createAuthorizationAdministrationTeamRole,
    removeAuthorizationAdministrationTeamMember,
    removeAuthorizationAdministrationUserGrant,
    updateAuthorizationAdministrationTeamRole,
} from "@/modules/authorization";
import type { AuthorizationAdministrationMutationContext } from "@/modules/authorization";
import { authorization } from "@/modules/authorization";
import type { AuthorizationActor } from "@/modules/authorization";

const TEST_PREFIX = "phase10b-authz";

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
    await prisma.auditLog.deleteMany({
        where: { userEmail: { startsWith: `${TEST_PREFIX}-` } },
    });
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

async function createUser(label: string, role: Role = Role.USER): Promise<{ id: number; email: string }> {
    const email = `${TEST_PREFIX}-${label}@integration.test`;
    return prisma.user.create({
        data: {
            email,
            name: `Phase 10B ${label}`,
            password: "integration-test-only",
            role,
        },
        select: { id: true, email: true },
    });
}

function mutationContext(actor: { id: number; email: string }): AuthorizationAdministrationMutationContext {
    return {
        principal: { userId: actor.id, systemRole: "ADMIN" },
        userEmail: actor.email,
        ipAddress: "203.0.113.10",
        userAgent: "phase-10b-integration",
    };
}

function userActor(userId: number): AuthorizationActor {
    return {
        userId,
        employeeId: null,
        systemRole: "USER",
        channel: "DASHBOARD",
    };
}

describe.sequential("Phase 10B authorization administration with real MySQL", () => {
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

    it("activates and deactivates a GRANTABLE Team grant through the resolver", async () => {
        const admin = await createUser("admin-team", Role.ADMIN);
        const target = await createUser("target-team");
        const team = await createAuthorizationAdministrationTeam(
            mutationContext(admin),
            { key: `${TEST_PREFIX}-team`, name: "Team test" },
        );

        await addAuthorizationAdministrationTeamGrant(
            mutationContext(admin),
            team.id,
            { capabilityKey: "audit.read", scope: "ALL" },
        );
        await addAuthorizationAdministrationTeamMember(
            mutationContext(admin),
            team.id,
            { userId: target.id },
        );

        const allowed = await authorization.resolve(userActor(target.id), "audit.read");
        expect(allowed).toMatchObject({
            allowed: true,
            grants: [{ source: { type: "TEAM", teamId: team.id } }],
        });

        await removeAuthorizationAdministrationTeamMember(
            mutationContext(admin),
            team.id,
            target.id,
        );
        const denied = await authorization.resolve(userActor(target.id), "audit.read");
        expect(denied).toMatchObject({
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });

        const audit = await getAuditLogs({
            action: "TEAM_MEMBER_ADD",
            userId: admin.id,
            page: 1,
            limit: 20,
        });
        expect(audit.auditLogs).toHaveLength(1);
        expect(audit.auditLogs[0]).toMatchObject({
            entityType: "Team",
            entityId: team.id,
            details: {
                after: { teamId: team.id, userId: target.id, teamRoleId: null },
                metadata: { teamId: team.id, targetUserId: target.id },
            },
        });
    });

    it("activates a GRANTABLE TeamRole grant and disabling the role removes applicability", async () => {
        const admin = await createUser("admin-role", Role.ADMIN);
        const target = await createUser("target-role");
        const team = await createAuthorizationAdministrationTeam(
            mutationContext(admin),
            { key: `${TEST_PREFIX}-role-team`, name: "Role team" },
        );
        const role = await createAuthorizationAdministrationTeamRole(
            mutationContext(admin),
            team.id,
            { key: "operator", name: "Operator" },
        );
        await addAuthorizationAdministrationTeamRoleGrant(
            mutationContext(admin),
            team.id,
            role.id,
            { capabilityKey: "audit.read", scope: "ALL" },
        );
        await addAuthorizationAdministrationTeamMember(
            mutationContext(admin),
            team.id,
            { userId: target.id, teamRoleId: role.id },
        );

        const allowed = await authorization.resolve(userActor(target.id), "audit.read");
        expect(allowed).toMatchObject({
            allowed: true,
            grants: [{ source: { type: "TEAM_ROLE", teamId: team.id, teamRoleId: role.id } }],
        });

        await updateAuthorizationAdministrationTeamRole(
            mutationContext(admin),
            team.id,
            role.id,
            { isActive: false },
        );
        const denied = await authorization.resolve(userActor(target.id), "audit.read");
        expect(denied).toMatchObject({
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
    });

    it("activates and removes an exceptional direct User grant", async () => {
        const admin = await createUser("admin-user", Role.ADMIN);
        const target = await createUser("target-user");

        await addAuthorizationAdministrationUserGrant(
            mutationContext(admin),
            target.id,
            { capabilityKey: "audit.read", scope: "ALL" },
        );
        expect(await authorization.resolve(userActor(target.id), "audit.read")).toMatchObject({
            allowed: true,
            grants: [{ source: { type: "USER", userId: target.id } }],
        });

        await removeAuthorizationAdministrationUserGrant(
            mutationContext(admin),
            target.id,
            { capabilityKey: "audit.read", scope: "ALL" },
        );
        expect(await authorization.resolve(userActor(target.id), "audit.read")).toMatchObject({
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
    });

    it("rolls back a Team mutation when strict audit append fails", async () => {
        const key = `${TEST_PREFIX}-rollback-team`;
        const missingAuditActor = {
            id: 2_147_483_000,
            email: `${TEST_PREFIX}-missing-audit-actor@integration.test`,
        };

        await expect(
            createAuthorizationAdministrationTeam(
                mutationContext(missingAuditActor),
                { key, name: "Rollback team" },
            ),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        await expect(
            prisma.team.findUnique({ where: { key } }),
        ).resolves.toBeNull();
    });
});
