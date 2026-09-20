import crypto from "node:crypto";

import { Role, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    buildEmployeeAuthorizedCommandActor,
    updateEmployee,
} from "@/modules/employee";
import { getEmployeeLeaveOffboardingBlockers } from "@/modules/leave";
import {
    changeSystemRole,
    employeeAccountLifecycle,
    type SystemRoleChangeActor,
} from "@/modules/auth";

const RUN_PREFIX = `phase12hh-system-role-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;

const ELIGIBLE_ACTIVE_ADMIN_WHERE = {
    role: Role.ADMIN,
    isActive: true,
    deletedAt: null,
    employee: {
        is: {
            status: "ACTIVE",
            deletedAt: null,
        },
    },
} as const satisfies Prisma.UserWhereInput;

type FixtureEmployeeStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

interface FixtureAccount {
    readonly user: {
        readonly id: number;
        readonly email: string;
        readonly role: Role;
    };
    readonly employee: {
        readonly id: number;
    } | null;
}

interface FixtureAccountOptions {
    readonly role?: Role;
    readonly isActive?: boolean;
    readonly userDeletedAt?: Date | null;
    readonly employeeStatus?: FixtureEmployeeStatus;
    readonly employeeDeletedAt?: Date | null;
    readonly linkedEmployee?: boolean;
}

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

function fixtureEmail(slug: string, kind: "user" | "employee"): string {
    return `${RUN_PREFIX}-${slug}-${kind}@thainhf.org`;
}

async function cleanFixtures(): Promise<void> {
    const [fixtureEmployees, fixtureUsers, fixtureTeams, fixtureDepartments] =
        await Promise.all([
            prisma.employee.findMany({
                where: { email: { startsWith: RUN_PREFIX } },
                select: { id: true },
            }),
            prisma.user.findMany({
                where: { email: { startsWith: RUN_PREFIX } },
                select: { id: true, email: true },
            }),
            prisma.team.findMany({
                where: { key: { startsWith: RUN_PREFIX } },
                select: { id: true },
            }),
            prisma.department.findMany({
                where: { code: { startsWith: RUN_PREFIX } },
                select: { id: true },
            }),
        ]);

    const employeeIds = fixtureEmployees.map(({ id }) => id);
    const userIds = fixtureUsers.map(({ id }) => id);
    const userEmails = fixtureUsers.map(({ email }) => email);
    const teamIds = fixtureTeams.map(({ id }) => id);

    const fixtureTeamRoles = teamIds.length === 0
        ? []
        : await prisma.teamRole.findMany({
            where: { teamId: { in: teamIds } },
            select: { id: true },
        });
    const teamRoleIds = fixtureTeamRoles.map(({ id }) => id);

    const auditPredicates: Prisma.AuditLogWhereInput[] = [
        { userEmail: { startsWith: RUN_PREFIX } },
        ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
        ...(employeeIds.length > 0
            ? [{ entityType: "Employee", entityId: { in: employeeIds } }]
            : []),
        ...(userIds.length > 0
            ? [{ entityType: "User", entityId: { in: userIds } }]
            : []),
    ];
    await prisma.auditLog.deleteMany({ where: { OR: auditPredicates } });

    if (userIds.length > 0) {
        await prisma.authRefreshToken.deleteMany({
            where: { userId: { in: userIds } },
        });
        await prisma.passwordResetToken.deleteMany({
            where: { email: { in: userEmails } },
        });
        await prisma.userCapabilityGrant.deleteMany({
            where: { userId: { in: userIds } },
        });
    }
    if (teamIds.length > 0 || userIds.length > 0) {
        await prisma.teamMembership.deleteMany({
            where: {
                OR: [
                    ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
                    ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                ],
            },
        });
    }
    if (teamRoleIds.length > 0) {
        await prisma.teamRoleCapabilityGrant.deleteMany({
            where: { teamRoleId: { in: teamRoleIds } },
        });
    }
    if (teamIds.length > 0) {
        await prisma.teamCapabilityGrant.deleteMany({
            where: { teamId: { in: teamIds } },
        });
    }
    if (teamRoleIds.length > 0) {
        await prisma.teamRole.deleteMany({
            where: { id: { in: teamRoleIds } },
        });
    }
    if (teamIds.length > 0) {
        await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    }
    if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (employeeIds.length > 0) {
        await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    }
    if (fixtureDepartments.length > 0) {
        await prisma.department.deleteMany({
            where: { id: { in: fixtureDepartments.map(({ id }) => id) } },
        });
    }
}

async function createDepartment(slug: string): Promise<number> {
    const department = await prisma.department.create({
        data: {
            name: `${RUN_PREFIX}-${slug}`,
            code: `${RUN_PREFIX}-${slug}`,
        },
        select: { id: true },
    });
    return department.id;
}

async function createAccount(
    departmentId: number,
    slug: string,
    options: FixtureAccountOptions = {},
): Promise<FixtureAccount> {
    const linkedEmployee = options.linkedEmployee !== false;
    const employee = linkedEmployee
        ? await prisma.employee.create({
            data: {
                firstName: "Phase 12H-H",
                lastName: slug,
                email: fixtureEmail(slug, "employee"),
                position: "Integration Test",
                departmentId,
                status: options.employeeStatus ?? "ACTIVE",
                deletedAt: options.employeeDeletedAt ?? null,
            },
            select: { id: true },
        })
        : null;
    const user = await prisma.user.create({
        data: {
            email: fixtureEmail(slug, "user"),
            name: `Phase 12H-H ${slug}`,
            password: "integration-test-only",
            role: options.role ?? Role.USER,
            isActive: options.isActive ?? true,
            deletedAt: options.userDeletedAt ?? null,
            ...(employee ? { employeeId: employee.id } : {}),
        },
        select: { id: true, email: true, role: true },
    });
    return { user, employee };
}

function systemRoleActor(account: FixtureAccount): SystemRoleChangeActor {
    return {
        userId: account.user.id,
        userEmail: account.user.email,
        ipAddress: "192.0.2.12",
        userAgent: `${RUN_PREFIX}-system-role-test`,
    };
}

function employeeLifecycleActor(account: FixtureAccount) {
    return buildEmployeeAuthorizedCommandActor({
        id: account.user.id,
        email: account.user.email,
        role: account.user.role,
    });
}

async function findEligibleAdminIds(): Promise<number[]> {
    const admins = await prisma.user.findMany({
        where: ELIGIBLE_ACTIVE_ADMIN_WHERE,
        select: { id: true },
        orderBy: { id: "asc" },
    });
    return admins.map(({ id }) => id);
}

async function createEmployeeUpdateGrant(userId: number): Promise<void> {
    await prisma.userCapabilityGrant.create({
        data: {
            userId,
            capabilityKey: "employee.update",
            scope: "ALL",
        },
    });
}

async function offboardEmployee(
    target: FixtureAccount,
    actor: FixtureAccount,
) {
    if (!target.employee) throw new Error("ต้องมี Employee สำหรับ lifecycle test");
    return updateEmployee(
        target.employee.id,
        { status: "INACTIVE" },
        employeeLifecycleActor(actor),
        getEmployeeLeaveOffboardingBlockers,
        employeeAccountLifecycle,
    );
}

async function createBusinessAuthorityFixture(
    userId: number,
): Promise<{ teamId: number; teamRoleId: number }> {
    const team = await prisma.team.create({
        data: {
            key: `${RUN_PREFIX}-business-team`,
            name: "Phase 12H-H business authority team",
        },
        select: { id: true },
    });
    const teamRole = await prisma.teamRole.create({
        data: {
            teamId: team.id,
            key: "operator",
            name: "Operator",
        },
        select: { id: true },
    });
    await prisma.teamMembership.create({
        data: {
            teamId: team.id,
            userId,
            teamRoleId: teamRole.id,
        },
    });
    await prisma.teamCapabilityGrant.create({
        data: {
            teamId: team.id,
            capabilityKey: "employee.read",
            scope: "ALL",
        },
    });
    await prisma.teamRoleCapabilityGrant.create({
        data: {
            teamRoleId: teamRole.id,
            capabilityKey: "audit.read",
            scope: "ALL",
        },
    });
    await prisma.userCapabilityGrant.create({
        data: {
            userId,
            capabilityKey: "routine.task.read",
            scope: "ALL",
        },
    });
    return { teamId: team.id, teamRoleId: teamRole.id };
}

async function readBusinessAuthorityState(userId: number): Promise<{
    readonly teamMemberships: Awaited<ReturnType<typeof prisma.teamMembership.findMany>>;
    readonly directGrants: Awaited<ReturnType<typeof prisma.userCapabilityGrant.findMany>>;
    readonly teamGrants: Awaited<ReturnType<typeof prisma.teamCapabilityGrant.findMany>>;
    readonly teamRoleGrants: Awaited<ReturnType<typeof prisma.teamRoleCapabilityGrant.findMany>>;
}> {
    const teamMemberships = await prisma.teamMembership.findMany({
        where: { userId },
        orderBy: [{ teamId: "asc" }, { userId: "asc" }],
    });
    const teamIds = teamMemberships.map(({ teamId }) => teamId);
    const teamRoleIds = teamMemberships
        .map(({ teamRoleId }) => teamRoleId)
        .filter((teamRoleId): teamRoleId is number => teamRoleId !== null);
    const [directGrants, teamGrants, teamRoleGrants] = await Promise.all([
        prisma.userCapabilityGrant.findMany({
            where: { userId },
            orderBy: [{ capabilityKey: "asc" }, { scope: "asc" }],
        }),
        teamIds.length > 0
            ? prisma.teamCapabilityGrant.findMany({
                where: { teamId: { in: teamIds } },
                orderBy: [{ teamId: "asc" }, { capabilityKey: "asc" }, { scope: "asc" }],
            })
            : Promise.resolve([]),
        teamRoleIds.length > 0
            ? prisma.teamRoleCapabilityGrant.findMany({
                where: { teamRoleId: { in: teamRoleIds } },
                orderBy: [{ teamRoleId: "asc" }, { capabilityKey: "asc" }, { scope: "asc" }],
            })
            : Promise.resolve([]),
    ]);
    return { teamMemberships, directGrants, teamGrants, teamRoleGrants };
}

function parseAuditDetails(value: string | null): Record<string, unknown> {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("รูปแบบรายละเอียด Audit ไม่ถูกต้อง");
    }
    return parsed as Record<string, unknown>;
}

describe.sequential("Auth system-role lifecycle with real MySQL", () => {
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

    it("persists a real USER to ADMIN change and leaves business authority empty", async () => {
        const departmentId = await createDepartment("promotion");
        const actor = await createAccount(departmentId, "promotion-actor", {
            role: Role.ADMIN,
        });
        const target = await createAccount(departmentId, "promotion-target");
        const beforeBusinessAuthority = await readBusinessAuthorityState(target.user.id);

        await expect(changeSystemRole({
            targetUserId: target.user.id,
            systemRole: "ADMIN",
            actor: systemRoleActor(actor),
        })).resolves.toMatchObject({
            userId: target.user.id,
            before: "USER",
            after: "ADMIN",
        });

        const [persistedTarget, audit] = await Promise.all([
            prisma.user.findUniqueOrThrow({
                where: { id: target.user.id },
                select: { role: true },
            }),
            prisma.auditLog.findFirst({
                where: {
                    action: "USER_ROLE_CHANGE",
                    entityType: "User",
                    entityId: target.user.id,
                    userId: actor.user.id,
                },
                orderBy: { id: "desc" },
            }),
        ]);
        const afterBusinessAuthority = await readBusinessAuthorityState(target.user.id);

        expect(persistedTarget.role).toBe(Role.ADMIN);
        expect(afterBusinessAuthority).toEqual(beforeBusinessAuthority);
        expect(afterBusinessAuthority.teamMemberships).toHaveLength(0);
        expect(afterBusinessAuthority.directGrants).toHaveLength(0);
        expect(audit).toMatchObject({
            action: "USER_ROLE_CHANGE",
            entityType: "User",
            entityId: target.user.id,
            userId: actor.user.id,
            userEmail: actor.user.email,
            ipAddress: "192.0.2.12",
            userAgent: `${RUN_PREFIX}-system-role-test`,
        });
        expect(parseAuditDetails(audit?.details ?? null)).toMatchObject({
            before: { systemRole: "USER" },
            after: { systemRole: "ADMIN" },
            metadata: { targetUserId: target.user.id },
        });
    });

    it("preserves configured business authority when demoting an ADMIN", async () => {
        const departmentId = await createDepartment("demotion-business-authority");
        const target = await createAccount(departmentId, "demotion-target", {
            role: Role.ADMIN,
        });
        const actor = await createAccount(departmentId, "demotion-actor", {
            role: Role.ADMIN,
        });
        await createBusinessAuthorityFixture(target.user.id);
        const beforeBusinessAuthority = await readBusinessAuthorityState(target.user.id);

        await expect(changeSystemRole({
            targetUserId: target.user.id,
            systemRole: "USER",
            actor: systemRoleActor(actor),
        })).resolves.toMatchObject({
            userId: target.user.id,
            before: "ADMIN",
            after: "USER",
        });

        const [persistedTarget, afterBusinessAuthority] = await Promise.all([
            prisma.user.findUniqueOrThrow({
                where: { id: target.user.id },
                select: { role: true },
            }),
            readBusinessAuthorityState(target.user.id),
        ]);
        expect(persistedTarget.role).toBe(Role.USER);
        expect(afterBusinessAuthority).toEqual(beforeBusinessAuthority);
    });

    it("proves real MySQL locking keeps one eligible ADMIN during concurrent demotions", async () => {
        const departmentId = await createDepartment("concurrent-demotion");
        const adminA = await createAccount(departmentId, "concurrent-admin-a", {
            role: Role.ADMIN,
        });
        const adminB = await createAccount(departmentId, "concurrent-admin-b", {
            role: Role.ADMIN,
        });

        const results = await Promise.allSettled([
            changeSystemRole({
                targetUserId: adminA.user.id,
                systemRole: "USER",
                actor: systemRoleActor(adminB),
            }),
            changeSystemRole({
                targetUserId: adminB.user.id,
                systemRole: "USER",
                actor: systemRoleActor(adminA),
            }),
        ]);
        const fulfilled = results.filter((result) => result.status === "fulfilled");
        const rejected = results.find(
            (result): result is PromiseRejectedResult => result.status === "rejected",
        );

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toBeDefined();
        expect(rejected?.reason).toMatchObject({
            code: "LAST_ELIGIBLE_ADMIN",
            statusCode: 409,
        });

        const [eligibleAdminIds, targetUsers] = await Promise.all([
            findEligibleAdminIds(),
            prisma.user.findMany({
                where: { id: { in: [adminA.user.id, adminB.user.id] } },
                select: { id: true, role: true },
                orderBy: { id: "asc" },
            }),
        ]);
        expect(eligibleAdminIds).toHaveLength(1);
        expect(targetUsers.filter(({ role }) => role === Role.USER)).toHaveLength(1);
    });

    it.each([
        ["ADMIN A demotion vs ADMIN B offboarding", "a", "b"],
        ["ADMIN B demotion vs ADMIN A offboarding", "b", "a"],
    ] as const)(
        "proves the real cross-path race is safe: %s",
        async (_label, demotionTargetKey, offboardTargetKey) => {
            const departmentId = await createDepartment(`cross-path-${demotionTargetKey}`);
            const adminA = await createAccount(departmentId, `cross-admin-a-${demotionTargetKey}`, {
                role: Role.ADMIN,
            });
            const adminB = await createAccount(departmentId, `cross-admin-b-${offboardTargetKey}`, {
                role: Role.ADMIN,
            });
            await Promise.all([
                createEmployeeUpdateGrant(adminA.user.id),
                createEmployeeUpdateGrant(adminB.user.id),
            ]);

            const accounts = { a: adminA, b: adminB } as const;
            const demotionTarget = accounts[demotionTargetKey];
            const offboardTarget = accounts[offboardTargetKey];
            const demotionActor = accounts[demotionTargetKey === "a" ? "b" : "a"];

            const [roleResult, lifecycleResult] = await Promise.allSettled([
                changeSystemRole({
                    targetUserId: demotionTarget.user.id,
                    systemRole: "USER",
                    actor: systemRoleActor(demotionActor),
                }),
                offboardEmployee(offboardTarget, demotionTarget),
            ]);

            expect(lifecycleResult.status).toBe("fulfilled");
            if (lifecycleResult.status !== "fulfilled") {
                throw lifecycleResult.reason;
            }
            const roleSucceeded = roleResult.status === "fulfilled";
            const lifecycleSucceeded = lifecycleResult.value.success;
            expect([roleSucceeded, lifecycleSucceeded].filter(Boolean)).toHaveLength(1);
            if (!roleSucceeded) {
                expect(roleResult.reason).toMatchObject({
                    code: "LAST_ELIGIBLE_ADMIN",
                    statusCode: 409,
                });
            }
            if (!lifecycleSucceeded) {
                expect(lifecycleResult.value.status).toBe(409);
            }

            await expect(findEligibleAdminIds()).resolves.toHaveLength(1);
        },
    );

    it("counts only a usable active ADMIN as the last control-plane root", async () => {
        const departmentId = await createDepartment("eligibility-matrix");
        const eligibleAdmin = await createAccount(departmentId, "eligible-admin", {
            role: Role.ADMIN,
        });
        const inactiveUserAdmin = await createAccount(departmentId, "inactive-user-admin", {
            role: Role.ADMIN,
            isActive: false,
        });
        const deletedUserAdmin = await createAccount(departmentId, "deleted-user-admin", {
            role: Role.ADMIN,
            userDeletedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const unlinkedAdmin = await createAccount(departmentId, "unlinked-admin", {
            role: Role.ADMIN,
            linkedEmployee: false,
        });
        await createAccount(departmentId, "inactive-employee-admin", {
            role: Role.ADMIN,
            employeeStatus: "INACTIVE",
        });
        await createAccount(departmentId, "suspended-employee-admin", {
            role: Role.ADMIN,
            employeeStatus: "SUSPENDED",
        });
        await createAccount(departmentId, "deleted-employee-admin", {
            role: Role.ADMIN,
            employeeDeletedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        await expect(findEligibleAdminIds()).resolves.toEqual([eligibleAdmin.user.id]);
        await expect(changeSystemRole({
            targetUserId: eligibleAdmin.user.id,
            systemRole: "USER",
            actor: systemRoleActor(unlinkedAdmin),
        })).rejects.toMatchObject({
            code: "LAST_ELIGIBLE_ADMIN",
            statusCode: 409,
        });
        await expect(prisma.user.findUniqueOrThrow({
            where: { id: eligibleAdmin.user.id },
            select: { role: true },
        })).resolves.toMatchObject({ role: Role.ADMIN });

        expect(inactiveUserAdmin.user.role).toBe(Role.ADMIN);
        expect(deletedUserAdmin.user.role).toBe(Role.ADMIN);
    });
});
