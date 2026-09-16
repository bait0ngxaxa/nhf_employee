import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auditAppendMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/modules/audit", () => ({
    appendAuditInTransaction: auditAppendMock,
}));

import {
    addAuthorizationAdministrationTeamGrant,
    addAuthorizationAdministrationTeamMember,
    addAuthorizationAdministrationTeamRoleGrant,
    addAuthorizationAdministrationUserGrant,
    changeAuthorizationAdministrationTeamMemberRole,
    createAuthorizationAdministrationTeam,
    createAuthorizationAdministrationTeamRole,
    removeAuthorizationAdministrationTeamGrant,
    removeAuthorizationAdministrationTeamMember,
    removeAuthorizationAdministrationTeamRoleGrant,
    removeAuthorizationAdministrationUserGrant,
    updateAuthorizationAdministrationTeam,
    updateAuthorizationAdministrationTeamRole,
} from "@/modules/authorization";
import type {
    AuthorizationAdministrationMutationDependencies,
    AuthorizationAdministrationMutationRepository,
    AuthorizationAdministrationMutationTeam,
    AuthorizationAdministrationMutationTeamGrant,
    AuthorizationAdministrationMutationTeamRole,
    AuthorizationAdministrationMutationTeamRoleGrant,
    AuthorizationAdministrationMutationUserGrant,
} from "@/modules/authorization";

const ADMIN_CONTEXT = {
    principal: { userId: 1, systemRole: "ADMIN" as const },
    userEmail: "admin@example.com",
    ipAddress: "203.0.113.10",
    userAgent: "phase-10b-test",
};

const USER_CONTEXT = {
    principal: { userId: 2, systemRole: "USER" as const },
};

const TX = {} as Prisma.TransactionClient;

function team(overrides: Partial<AuthorizationAdministrationMutationTeam> = {}): AuthorizationAdministrationMutationTeam {
    return {
        id: 10,
        key: "people",
        name: "People",
        description: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

function role(overrides: Partial<AuthorizationAdministrationMutationTeamRole> = {}): AuthorizationAdministrationMutationTeamRole {
    return {
        id: 20,
        teamId: 10,
        key: "operator",
        name: "Operator",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

function teamGrant(overrides: Partial<AuthorizationAdministrationMutationTeamGrant> = {}): AuthorizationAdministrationMutationTeamGrant {
    return {
        teamId: 10,
        capabilityKey: "audit.read",
        scope: "ALL",
        ...overrides,
    };
}

function roleGrant(overrides: Partial<AuthorizationAdministrationMutationTeamRoleGrant> = {}): AuthorizationAdministrationMutationTeamRoleGrant {
    return {
        teamRoleId: 20,
        teamId: 10,
        capabilityKey: "audit.read",
        scope: "ALL",
        ...overrides,
    };
}

function userGrant(overrides: Partial<AuthorizationAdministrationMutationUserGrant> = {}): AuthorizationAdministrationMutationUserGrant {
    return {
        userId: 7,
        capabilityKey: "audit.read",
        scope: "ALL",
        ...overrides,
    };
}

function repository(
    overrides: Partial<AuthorizationAdministrationMutationRepository> = {},
): AuthorizationAdministrationMutationRepository {
    const method = () => vi.fn().mockResolvedValue(null);
    return {
        findTeamById: method(),
        findTeamByKey: method(),
        createTeam: method(),
        updateTeam: method(),
        findTeamRoleById: method(),
        findTeamRoleByTeamAndKey: method(),
        createTeamRole: method(),
        updateTeamRole: method(),
        findUserById: method(),
        findMembership: method(),
        listMembershipsForTeam: vi.fn().mockResolvedValue([]),
        createMembership: method(),
        updateMembershipRole: method(),
        deleteMembership: method(),
        listTeamGrants: vi.fn().mockResolvedValue([]),
        listTeamRoleGrantsForTeam: vi.fn().mockResolvedValue([]),
        listTeamRoleGrants: vi.fn().mockResolvedValue([]),
        findTeamGrant: method(),
        createTeamGrant: method(),
        deleteTeamGrant: method(),
        findTeamRoleGrant: method(),
        createTeamRoleGrant: method(),
        deleteTeamRoleGrant: method(),
        findUserGrant: method(),
        createUserGrant: method(),
        deleteUserGrant: method(),
        ...overrides,
    } as AuthorizationAdministrationMutationRepository;
}

function dependencies(
    repo: AuthorizationAdministrationMutationRepository,
    transactionRunner: AuthorizationAdministrationMutationDependencies["transactionRunner"] = async (callback) => callback(TX),
): AuthorizationAdministrationMutationDependencies {
    return { repository: repo, transactionRunner };
}

describe("Phase 10B Authorization Administration commands", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        auditAppendMock.mockReset().mockResolvedValue(undefined);
    });

    it("requires a trusted ADMIN principal and ignores a forged USER context", async () => {
        const repo = repository({
            findTeamByKey: vi.fn().mockResolvedValue(null),
            createTeam: vi.fn().mockResolvedValue(team()),
        });

        await expect(
            createAuthorizationAdministrationTeam(USER_CONTEXT, {
                key: "people",
                name: "People",
            }, dependencies(repo)),
        ).rejects.toMatchObject({ name: "AuthorizationAdministrationAccessError", code: "ADMIN_REQUIRED" });
        expect(repo.createTeam).not.toHaveBeenCalled();
    });

    it("creates a Team and appends the trusted actor plus before/after audit details", async () => {
        const created = team();
        const createTeam = vi.fn().mockResolvedValue(created);
        const repo = repository({
            findTeamByKey: vi.fn().mockResolvedValue(null),
            createTeam,
        });

        const result = await createAuthorizationAdministrationTeam(
            ADMIN_CONTEXT,
            { key: "people", name: "People" },
            dependencies(repo),
        );

        expect(result).toEqual(created);
        expect(auditAppendMock).toHaveBeenCalledWith(
            TX,
            expect.objectContaining({
                action: "TEAM_CREATE",
                entityType: "Team",
                entityId: created.id,
                userId: 1,
                userEmail: "admin@example.com",
                ipAddress: "203.0.113.10",
                userAgent: "phase-10b-test",
                details: expect.objectContaining({
                    before: undefined,
                    after: expect.objectContaining({ key: "people", name: "People" }),
                }),
            }),
        );
    });

    it("handles Team lifecycle actions, duplicate keys, and no-op updates without false audit rows", async () => {
        const current = team();
        const disabled = team({ isActive: false });
        const reenabled = team({ isActive: true });
        const updateTeam = vi.fn()
            .mockResolvedValueOnce(team({ name: "People Operations" }))
            .mockResolvedValueOnce(disabled)
            .mockResolvedValueOnce(reenabled);
        const repo = repository({
            findTeamByKey: vi.fn().mockResolvedValue(current),
            findTeamById: vi.fn()
                .mockResolvedValueOnce(current)
                .mockResolvedValueOnce(current)
                .mockResolvedValueOnce(disabled)
                .mockResolvedValueOnce(current),
            updateTeam,
        });

        await expect(
            createAuthorizationAdministrationTeam(
                ADMIN_CONTEXT,
                { key: "people", name: "People" },
                dependencies(repo),
            ),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        await updateAuthorizationAdministrationTeam(
            ADMIN_CONTEXT,
            10,
            { name: "People Operations" },
            dependencies(repo),
        );
        await updateAuthorizationAdministrationTeam(
            ADMIN_CONTEXT,
            10,
            { isActive: false },
            dependencies(repo),
        );
        await updateAuthorizationAdministrationTeam(
            ADMIN_CONTEXT,
            10,
            { isActive: true },
            dependencies(repo),
        );
        await expect(
            updateAuthorizationAdministrationTeam(
                ADMIN_CONTEXT,
                10,
                { isActive: true },
                dependencies(repo),
            ),
        ).rejects.toMatchObject({ code: "NO_STATE_CHANGE" });

        expect(updateTeam).toHaveBeenCalledTimes(3);
        expect(auditAppendMock.mock.calls.map(([_, command]) => command.action)).toEqual([
            "TEAM_UPDATE",
            "TEAM_DISABLE",
            "TEAM_UPDATE",
        ]);
    });

    it("does not leave a Team behind when strict audit append fails", async () => {
        let persisted = false;
        const createTeam = vi.fn().mockImplementation(async () => {
            persisted = true;
            return team();
        });
        auditAppendMock.mockRejectedValue(new Error("audit unavailable"));
        const runner: AuthorizationAdministrationMutationDependencies["transactionRunner"] = async (callback) => {
            try {
                return await callback(TX);
            } catch (error) {
                persisted = false;
                throw error;
            }
        };
        const repo = repository({
            findTeamByKey: vi.fn().mockResolvedValue(null),
            createTeam,
        });

        await expect(
            createAuthorizationAdministrationTeam(
                ADMIN_CONTEXT,
                { key: "people", name: "People" },
                dependencies(repo, runner),
            ),
        ).rejects.toThrow("audit unavailable");
        expect(persisted).toBe(false);
    });

    it.each([
        ["routine.task.read", "ALL"],
        ["stock.request.read", "OWN"],
        ["leave.request.read", "OWN"],
    ] as const)("rejects %s before opening a transaction when readiness is not GRANTABLE", async (capabilityKey, scope) => {
        const transactionRunner = vi.fn(
            async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
                callback(TX),
        ) as unknown as NonNullable<AuthorizationAdministrationMutationDependencies["transactionRunner"]>;
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
        });

        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey, scope },
                dependencies(repo, transactionRunner),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_POLICY_ACTIVATION_REQUIRED" });
        expect(transactionRunner).not.toHaveBeenCalled();
    });

    it("accepts add/remove through generic Team, TeamRole, and User commands for default-policy capabilities", async () => {
        const departmentGrant = teamGrant({
            capabilityKey: "department.read",
            scope: "ALL",
        });
        const notificationReadGrant = roleGrant({
            capabilityKey: "notification.inbox.read",
            scope: "OWN",
        });
        const notificationUpdateGrant = userGrant({
            capabilityKey: "notification.inbox.update",
            scope: "OWN",
        });
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(departmentGrant),
            createTeamGrant: vi.fn().mockResolvedValue(departmentGrant),
            deleteTeamGrant: vi.fn().mockResolvedValue(departmentGrant),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            findTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(notificationReadGrant),
            createTeamRoleGrant: vi.fn().mockResolvedValue(notificationReadGrant),
            deleteTeamRoleGrant: vi.fn().mockResolvedValue(notificationReadGrant),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findUserGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(notificationUpdateGrant),
            createUserGrant: vi.fn().mockResolvedValue(notificationUpdateGrant),
            deleteUserGrant: vi.fn().mockResolvedValue(notificationUpdateGrant),
        });
        const deps = dependencies(repo);

        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "department.read", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(departmentGrant);
        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "department.read", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(departmentGrant);

        await expect(
            addAuthorizationAdministrationTeamRoleGrant(
                ADMIN_CONTEXT,
                10,
                20,
                { capabilityKey: "notification.inbox.read", scope: "OWN" },
                deps,
            ),
        ).resolves.toEqual(notificationReadGrant);
        await expect(
            removeAuthorizationAdministrationTeamRoleGrant(
                ADMIN_CONTEXT,
                10,
                20,
                { capabilityKey: "notification.inbox.read", scope: "OWN" },
                deps,
            ),
        ).resolves.toEqual(notificationReadGrant);

        await expect(
            addAuthorizationAdministrationUserGrant(
                ADMIN_CONTEXT,
                7,
                { capabilityKey: "notification.inbox.update", scope: "OWN" },
                deps,
            ),
        ).resolves.toEqual(notificationUpdateGrant);
        await expect(
            removeAuthorizationAdministrationUserGrant(
                ADMIN_CONTEXT,
                7,
                { capabilityKey: "notification.inbox.update", scope: "OWN" },
                deps,
            ),
        ).resolves.toEqual(notificationUpdateGrant);

        expect(repo.createTeamGrant).toHaveBeenCalledWith(TX, departmentGrant);
        expect(repo.createTeamRoleGrant).toHaveBeenCalledWith(TX, notificationReadGrant);
        expect(repo.createUserGrant).toHaveBeenCalledWith(TX, notificationUpdateGrant);
        expect(auditAppendMock).toHaveBeenCalledTimes(6);
    });

    it("accepts newly activated Employee grants through Team, TeamRole, and User commands", async () => {
        const employeeTeamGrant = teamGrant({
            capabilityKey: "employee.read",
            scope: "ALL",
        });
        const employeeTeamRoleGrant = roleGrant({
            capabilityKey: "employee.stats.read",
            scope: "ALL",
        });
        const employeeUserGrant = userGrant({
            capabilityKey: "employee.export",
            scope: "ALL",
        });
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(employeeTeamGrant),
            createTeamGrant: vi.fn().mockResolvedValue(employeeTeamGrant),
            deleteTeamGrant: vi.fn().mockResolvedValue(employeeTeamGrant),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            findTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(employeeTeamRoleGrant),
            createTeamRoleGrant: vi.fn().mockResolvedValue(employeeTeamRoleGrant),
            deleteTeamRoleGrant: vi.fn().mockResolvedValue(employeeTeamRoleGrant),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findUserGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(employeeUserGrant),
            createUserGrant: vi.fn().mockResolvedValue(employeeUserGrant),
            deleteUserGrant: vi.fn().mockResolvedValue(employeeUserGrant),
        });
        const deps = dependencies(repo);

        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "employee.read", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(employeeTeamGrant);
        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "employee.read", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(employeeTeamGrant);

        await expect(
            addAuthorizationAdministrationTeamRoleGrant(
                ADMIN_CONTEXT,
                10,
                20,
                { capabilityKey: "employee.stats.read", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(employeeTeamRoleGrant);
        await expect(
            removeAuthorizationAdministrationTeamRoleGrant(
                ADMIN_CONTEXT,
                10,
                20,
                { capabilityKey: "employee.stats.read", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(employeeTeamRoleGrant);

        await expect(
            addAuthorizationAdministrationUserGrant(
                ADMIN_CONTEXT,
                7,
                { capabilityKey: "employee.export", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(employeeUserGrant);
        await expect(
            removeAuthorizationAdministrationUserGrant(
                ADMIN_CONTEXT,
                7,
                { capabilityKey: "employee.export", scope: "ALL" },
                deps,
            ),
        ).resolves.toEqual(employeeUserGrant);

        expect(repo.createTeamGrant).toHaveBeenCalledWith(TX, employeeTeamGrant);
        expect(repo.createTeamRoleGrant).toHaveBeenCalledWith(TX, employeeTeamRoleGrant);
        expect(repo.createUserGrant).toHaveBeenCalledWith(TX, employeeUserGrant);
        expect(auditAppendMock).toHaveBeenCalledTimes(6);
    });

    it("rejects unknown and unsupported grant values without normalizing them", async () => {
        const transactionRunner = vi.fn(
            async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
                callback(TX),
        ) as unknown as NonNullable<AuthorizationAdministrationMutationDependencies["transactionRunner"]>;
        const repo = repository();

        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: " unknown.capability ", scope: "ALL" },
                dependencies(repo, transactionRunner),
            ),
        ).rejects.toMatchObject({ code: "UNKNOWN_CAPABILITY" });
        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "audit.read", scope: " ALL " },
                dependencies(repo, transactionRunner),
            ),
        ).rejects.toMatchObject({ code: "UNSUPPORTED_SCOPE" });
        expect(transactionRunner).not.toHaveBeenCalled();

        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "routine.task.export", scope: "ALL" },
                dependencies(repo, transactionRunner),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_DEFERRED" });
        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "routine.task.export", scope: "ALL" },
                dependencies(repo, transactionRunner),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_DEFERRED" });
        expect(transactionRunner).not.toHaveBeenCalled();
        expect(auditAppendMock).not.toHaveBeenCalled();
    });

    it("guards Team lifecycle changes against affected non-grantable persisted grants", async () => {
        const updateTeam = vi.fn();
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            listMembershipsForTeam: vi.fn().mockResolvedValue([{
                teamId: 10,
                userId: 7,
                teamRoleId: null,
                role: null,
            }]),
            listTeamGrants: vi.fn().mockResolvedValue([
                teamGrant({ capabilityKey: "routine.task.read" }),
            ]),
            listTeamRoleGrantsForTeam: vi.fn().mockResolvedValue([]),
            updateTeam,
        });

        await expect(
            updateAuthorizationAdministrationTeam(
                ADMIN_CONTEXT,
                10,
                { isActive: false },
                dependencies(repo),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_POLICY_ACTIVATION_REQUIRED" });
        expect(updateTeam).not.toHaveBeenCalled();
    });

    it("does not block Team lifecycle changes when no membership can receive Team grants", async () => {
        const disabled = team({ isActive: false });
        const updateTeam = vi.fn().mockResolvedValue(disabled);
        const listTeamGrants = vi.fn().mockResolvedValue([
            teamGrant({ capabilityKey: "routine.task.read" }),
        ]);
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            listMembershipsForTeam: vi.fn().mockResolvedValue([]),
            listTeamGrants,
            updateTeam,
        });

        await expect(
            updateAuthorizationAdministrationTeam(
                ADMIN_CONTEXT,
                10,
                { isActive: false },
                dependencies(repo),
            ),
        ).resolves.toEqual(disabled);
        expect(listTeamGrants).not.toHaveBeenCalled();
        expect(updateTeam).toHaveBeenCalledOnce();
    });

    it("ignores inactive TeamRole grants during Team lifecycle impact checks", async () => {
        const disabled = team({ isActive: false });
        const updateTeam = vi.fn().mockResolvedValue(disabled);
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            listMembershipsForTeam: vi.fn().mockResolvedValue([{
                teamId: 10,
                userId: 7,
                teamRoleId: 20,
                role: role({ isActive: false }),
            }]),
            listTeamRoleGrantsForTeam: vi.fn().mockResolvedValue([
                roleGrant({ capabilityKey: "routine.task.read" }),
            ]),
            updateTeam,
        });

        await expect(
            updateAuthorizationAdministrationTeam(
                ADMIN_CONTEXT,
                10,
                { isActive: false },
                dependencies(repo),
            ),
        ).resolves.toEqual(disabled);
        expect(updateTeam).toHaveBeenCalledOnce();
    });

    it("does not block an empty TeamRole lifecycle change", async () => {
        const disabledRole = role({ isActive: false });
        const updateTeamRole = vi.fn().mockResolvedValue(disabledRole);
        const listTeamRoleGrants = vi.fn().mockResolvedValue([
            roleGrant({ capabilityKey: "routine.task.read" }),
        ]);
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            listMembershipsForTeam: vi.fn().mockResolvedValue([]),
            listTeamRoleGrants,
            updateTeamRole,
        });

        await expect(
            updateAuthorizationAdministrationTeamRole(
                ADMIN_CONTEXT,
                10,
                20,
                { isActive: false },
                dependencies(repo),
            ),
        ).resolves.toEqual(disabledRole);
        expect(listTeamRoleGrants).not.toHaveBeenCalled();
        expect(updateTeamRole).toHaveBeenCalledOnce();
    });

    it("guards membership add and TeamRole lifecycle changes against affected grants", async () => {
        const membershipCreate = vi.fn();
        const membershipRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findMembership: vi.fn().mockResolvedValue(null),
            listTeamGrants: vi.fn().mockResolvedValue([
                teamGrant({ capabilityKey: "routine.task.read" }),
            ]),
            createMembership: membershipCreate,
        });
        await expect(
            addAuthorizationAdministrationTeamMember(
                ADMIN_CONTEXT,
                10,
                { userId: 7 },
                dependencies(membershipRepo),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_POLICY_ACTIVATION_REQUIRED" });
        expect(membershipCreate).not.toHaveBeenCalled();

        const roleUpdate = vi.fn();
        const roleRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            listMembershipsForTeam: vi.fn().mockResolvedValue([{
                teamId: 10,
                userId: 7,
                teamRoleId: 20,
                role: role(),
            }]),
            listTeamRoleGrants: vi.fn().mockResolvedValue([
                roleGrant({ capabilityKey: "routine.task.read" }),
            ]),
            updateTeamRole: roleUpdate,
        });
        await expect(
            updateAuthorizationAdministrationTeamRole(
                ADMIN_CONTEXT,
                10,
                20,
                { isActive: false },
                dependencies(roleRepo),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_POLICY_ACTIVATION_REQUIRED" });
        expect(roleUpdate).not.toHaveBeenCalled();
    });

    it("creates TeamRole, rejects cross-Team membership role assignment, and audits role lifecycle", async () => {
        const createdRole = role();
        const createTeamRole = vi.fn().mockResolvedValue(createdRole);
        const roleRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamRoleByTeamAndKey: vi.fn().mockResolvedValue(null),
            createTeamRole,
        });
        await expect(
            createAuthorizationAdministrationTeamRole(
                ADMIN_CONTEXT,
                10,
                { key: "operator", name: "Operator" },
                dependencies(roleRepo),
            ),
        ).resolves.toEqual(createdRole);

        const memberRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findMembership: vi.fn().mockResolvedValue(null),
            findTeamRoleById: vi.fn().mockResolvedValue(role({ teamId: 99 })),
        });
        await expect(
            addAuthorizationAdministrationTeamMember(
                ADMIN_CONTEXT,
                10,
                { userId: 7, teamRoleId: 20 },
                dependencies(memberRepo),
            ),
        ).rejects.toMatchObject({ code: "TEAM_ROLE_TEAM_MISMATCH" });
    });

    it("keeps TeamRole keys scoped to a Team and audits metadata updates", async () => {
        const duplicateRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamRoleByTeamAndKey: vi.fn().mockResolvedValue(role()),
            createTeamRole: vi.fn(),
        });
        await expect(
            createAuthorizationAdministrationTeamRole(
                ADMIN_CONTEXT,
                10,
                { key: "operator", name: "Operator" },
                dependencies(duplicateRepo),
            ),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        const updated = role({ name: "Team Operator" });
        const updateTeamRole = vi.fn().mockResolvedValue(updated);
        const updateRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            updateTeamRole,
        });
        await expect(
            updateAuthorizationAdministrationTeamRole(
                ADMIN_CONTEXT,
                10,
                20,
                { name: "Team Operator" },
                dependencies(updateRepo),
            ),
        ).resolves.toEqual(updated);
        expect(updateTeamRole).toHaveBeenCalledWith(
            TX,
            20,
            { name: "Team Operator", isActive: true },
        );
        expect(auditAppendMock).toHaveBeenCalledWith(
            TX,
            expect.objectContaining({
                action: "TEAM_ROLE_UPDATE",
                entityType: "TeamRole",
                entityId: 20,
            }),
        );
    });

    it("supports atomic membership add/remove and role change with dedicated audit actions", async () => {
        const membership = {
            teamId: 10,
            userId: 7,
            teamRoleId: 20,
            role: role(),
        };
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findMembership: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(membership)
                .mockResolvedValueOnce(membership),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            createMembership: vi.fn().mockResolvedValue(membership),
            updateMembershipRole: vi.fn().mockResolvedValue({ ...membership, teamRoleId: null, role: null }),
            deleteMembership: vi.fn().mockResolvedValue(membership),
        });
        const deps = dependencies(repo);

        await addAuthorizationAdministrationTeamMember(
            ADMIN_CONTEXT,
            10,
            { userId: 7, teamRoleId: 20 },
            deps,
        );
        await changeAuthorizationAdministrationTeamMemberRole(
            ADMIN_CONTEXT,
            10,
            7,
            { teamRoleId: null },
            deps,
        );
        await removeAuthorizationAdministrationTeamMember(
            ADMIN_CONTEXT,
            10,
            7,
            deps,
        );

        expect(auditAppendMock.mock.calls.map(([_, command]) => command.action)).toEqual([
            "TEAM_MEMBER_ADD",
            "TEAM_MEMBER_ROLE_CHANGE",
            "TEAM_MEMBER_REMOVE",
        ]);
    });

    it("keeps the authenticated principal separate from direct User grant targets in audit", async () => {
        const roleGrantValue = roleGrant();
        const directGrant = userGrant();
        const repo = repository({
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            findTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(roleGrantValue),
            createTeamRoleGrant: vi.fn().mockResolvedValue(roleGrantValue),
            deleteTeamRoleGrant: vi.fn().mockResolvedValue(roleGrantValue),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findUserGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(directGrant),
            createUserGrant: vi.fn().mockResolvedValue(directGrant),
            deleteUserGrant: vi.fn().mockResolvedValue(directGrant),
        });
        const deps = dependencies(repo);

        await addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "audit.read", scope: "ALL" },
            deps,
        );
        await removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "audit.read", scope: "ALL" },
            deps,
        );
        await addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "audit.read", scope: "ALL" },
            deps,
        );
        await removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "audit.read", scope: "ALL" },
            deps,
        );

        expect(auditAppendMock.mock.calls.map(([_, command]) => command.action)).toEqual([
            "TEAM_ROLE_CAPABILITY_GRANT_UPDATE",
            "TEAM_ROLE_CAPABILITY_GRANT_UPDATE",
            "USER_CAPABILITY_GRANT_ADD",
            "USER_CAPABILITY_GRANT_REMOVE",
        ]);
        expect(auditAppendMock).toHaveBeenCalledWith(
            TX,
            expect.objectContaining({
                action: "USER_CAPABILITY_GRANT_ADD",
                entityType: "User",
                entityId: 7,
                userId: ADMIN_CONTEXT.principal.userId,
                userEmail: ADMIN_CONTEXT.userEmail,
                ipAddress: ADMIN_CONTEXT.ipAddress,
                userAgent: ADMIN_CONTEXT.userAgent,
                details: expect.objectContaining({
                    metadata: expect.objectContaining({
                        userId: 7,
                        capabilityKey: "audit.read",
                        scope: "ALL",
                    }),
                }),
            }),
        );
    });

    it("rejects duplicate or missing exact Team grants and direct User TEAM scope", async () => {
        const duplicateCreate = vi.fn();
        const duplicateRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn().mockResolvedValue(teamGrant()),
            createTeamGrant: duplicateCreate,
        });
        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "audit.read", scope: "ALL" },
                dependencies(duplicateRepo),
            ),
        ).rejects.toMatchObject({ code: "DUPLICATE_GRANT" });
        expect(duplicateCreate).not.toHaveBeenCalled();

        const missingDelete = vi.fn();
        const missingRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn().mockResolvedValue(null),
            deleteTeamGrant: missingDelete,
        });
        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "audit.read", scope: "ALL" },
                dependencies(missingRepo),
            ),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(missingDelete).not.toHaveBeenCalled();

        await expect(
            addAuthorizationAdministrationUserGrant(
                ADMIN_CONTEXT,
                7,
                { capabilityKey: "audit.read", scope: "TEAM" },
                dependencies(repository()),
            ),
        ).rejects.toMatchObject({ code: "UNSUPPORTED_SCOPE" });
        expect(auditAppendMock).not.toHaveBeenCalled();
    });

    it("uses the same readiness gate for ordinary grant removal", async () => {
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn().mockResolvedValue(teamGrant({ capabilityKey: "routine.task.read" })),
        });

        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "routine.task.read", scope: "ALL" },
                dependencies(repo),
            ),
        ).rejects.toMatchObject({ code: "CAPABILITY_POLICY_ACTIVATION_REQUIRED" });
        expect(repo.findTeamGrant).not.toHaveBeenCalled();
    });
});
