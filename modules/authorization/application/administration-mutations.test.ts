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

    it("accepts add/remove for all eight registered Leave capabilities", async () => {
        const requestReadGrant = teamGrant({
            capabilityKey: "leave.request.read",
            scope: "OWN",
        });
        const requestCancelGrant = teamGrant({
            capabilityKey: "leave.request.cancel",
            scope: "OWN",
        });
        const approvalReadGrant = roleGrant({
            capabilityKey: "leave.approval.read",
            scope: "ASSIGNED",
        });
        const requestApproveGrant = roleGrant({
            capabilityKey: "leave.request.approve",
            scope: "ASSIGNED",
        });
        const cancellationDecisionGrant = roleGrant({
            capabilityKey: "leave.cancellation.decide",
            scope: "ASSIGNED",
        });
        const requestCreateGrant = userGrant({
            capabilityKey: "leave.request.create",
            scope: "OWN",
        });
        const notTakenGrant = userGrant({
            capabilityKey: "leave.request.not_taken",
            scope: "OWN",
        });
        const recoveryGrant = userGrant({
            capabilityKey: "leave.recovery.manage",
            scope: "ALL",
        });
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestReadGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestCancelGrant),
            createTeamGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            deleteTeamGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            findTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(approvalReadGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestApproveGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(cancellationDecisionGrant),
            createTeamRoleGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            deleteTeamRoleGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findUserGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestCreateGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(notTakenGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(recoveryGrant),
            createUserGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            deleteUserGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
        });
        const deps = dependencies(repo);

        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "leave.request.read", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestReadGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "leave.request.read", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestReadGrant);
        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "leave.request.cancel", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestCancelGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "leave.request.cancel", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestCancelGrant);

        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "leave.approval.read", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(approvalReadGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "leave.approval.read", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(approvalReadGrant);
        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "leave.request.approve", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(requestApproveGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "leave.request.approve", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(requestApproveGrant);
        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "leave.cancellation.decide", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(cancellationDecisionGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "leave.cancellation.decide", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(cancellationDecisionGrant);

        await expect(addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "leave.request.create", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestCreateGrant);
        await expect(removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "leave.request.create", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestCreateGrant);
        await expect(addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "leave.request.not_taken", scope: "OWN" },
            deps,
        )).resolves.toEqual(notTakenGrant);
        await expect(removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "leave.request.not_taken", scope: "OWN" },
            deps,
        )).resolves.toEqual(notTakenGrant);

        await expect(addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "leave.recovery.manage", scope: "ALL" },
            deps,
        )).resolves.toEqual(recoveryGrant);
        await expect(removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "leave.recovery.manage", scope: "ALL" },
            deps,
        )).resolves.toEqual(recoveryGrant);

        expect(auditAppendMock).toHaveBeenCalledTimes(16);
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

    it("accepts add/remove for all newly unlocked Stock default-policy capabilities", async () => {
        const catalogGrant = teamGrant({
            capabilityKey: "stock.catalog.read",
            scope: "ALL",
        });
        const requestReadGrant = roleGrant({
            capabilityKey: "stock.request.read",
            scope: "ALL",
        });
        const requestCreateGrant = userGrant({
            capabilityKey: "stock.request.create",
            scope: "OWN",
        });
        const requestCancelGrant = teamGrant({
            capabilityKey: "stock.request.cancel",
            scope: "ALL",
        });
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(catalogGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestCancelGrant),
            createTeamGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            deleteTeamGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            findTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestReadGrant),
            createTeamRoleGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            deleteTeamRoleGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findUserGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(requestCreateGrant),
            createUserGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
            deleteUserGrant: vi.fn().mockImplementation(async (_tx, grant) => grant),
        });
        const deps = dependencies(repo);

        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "stock.catalog.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(catalogGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "stock.catalog.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(catalogGrant);

        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "stock.request.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(requestReadGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "stock.request.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(requestReadGrant);

        await expect(addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "stock.request.create", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestCreateGrant);
        await expect(removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "stock.request.create", scope: "OWN" },
            deps,
        )).resolves.toEqual(requestCreateGrant);

        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "stock.request.cancel", scope: "ALL" },
            deps,
        )).resolves.toEqual(requestCancelGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "stock.request.cancel", scope: "ALL" },
            deps,
        )).resolves.toEqual(requestCancelGrant);

        expect(auditAppendMock).toHaveBeenCalledTimes(8);
    });

    it("accepts add/remove for all newly unlocked Routine default-policy capabilities", async () => {
        const routineReadGrant = teamGrant({
            capabilityKey: "routine.task.read",
            scope: "ALL",
        });
        const routineCreateGrant = roleGrant({
            capabilityKey: "routine.task.create",
            scope: "ALL",
        });
        const routineUpdateGrant = userGrant({
            capabilityKey: "routine.task.update",
            scope: "ALL",
        });
        const routineDeleteGrant = teamGrant({
            capabilityKey: "routine.task.delete",
            scope: "ALL",
        });
        const routineOccurrenceReadGrant = roleGrant({
            capabilityKey: "routine.occurrence.read",
            scope: "ALL",
        });
        const routineExportGrant = teamGrant({
            capabilityKey: "routine.task.export",
            scope: "ALL",
        });
        const routineSummaryGrant = roleGrant({
            capabilityKey: "routine.summary.read",
            scope: "ASSIGNED",
        });
        const routineReferenceGrant = userGrant({
            capabilityKey: "routine.reference.read",
            scope: "OWN",
        });
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineReadGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineDeleteGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineExportGrant),
            createTeamGrant: vi.fn()
                .mockResolvedValueOnce(routineReadGrant)
                .mockResolvedValueOnce(routineDeleteGrant)
                .mockResolvedValueOnce(routineExportGrant),
            deleteTeamGrant: vi.fn()
                .mockResolvedValueOnce(routineReadGrant)
                .mockResolvedValueOnce(routineDeleteGrant)
                .mockResolvedValueOnce(routineExportGrant),
            findTeamRoleById: vi.fn().mockResolvedValue(role()),
            findTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineCreateGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineOccurrenceReadGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineSummaryGrant),
            createTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(routineCreateGrant)
                .mockResolvedValueOnce(routineOccurrenceReadGrant)
                .mockResolvedValueOnce(routineSummaryGrant),
            deleteTeamRoleGrant: vi.fn()
                .mockResolvedValueOnce(routineCreateGrant)
                .mockResolvedValueOnce(routineOccurrenceReadGrant)
                .mockResolvedValueOnce(routineSummaryGrant),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findUserGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineUpdateGrant)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(routineReferenceGrant),
            createUserGrant: vi.fn()
                .mockResolvedValueOnce(routineUpdateGrant)
                .mockResolvedValueOnce(routineReferenceGrant),
            deleteUserGrant: vi.fn()
                .mockResolvedValueOnce(routineUpdateGrant)
                .mockResolvedValueOnce(routineReferenceGrant),
        });
        const deps = dependencies(repo);

        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "routine.task.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineReadGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "routine.task.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineReadGrant);

        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "routine.task.create", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineCreateGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "routine.task.create", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineCreateGrant);

        await expect(addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "routine.task.update", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineUpdateGrant);
        await expect(removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "routine.task.update", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineUpdateGrant);

        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "routine.task.delete", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineDeleteGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "routine.task.delete", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineDeleteGrant);

        await expect(addAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "routine.task.export", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineExportGrant);
        await expect(removeAuthorizationAdministrationTeamGrant(
            ADMIN_CONTEXT,
            10,
            { capabilityKey: "routine.task.export", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineExportGrant);

        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "routine.occurrence.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineOccurrenceReadGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "routine.occurrence.read", scope: "ALL" },
            deps,
        )).resolves.toEqual(routineOccurrenceReadGrant);

        await expect(addAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "routine.summary.read", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(routineSummaryGrant);
        await expect(removeAuthorizationAdministrationTeamRoleGrant(
            ADMIN_CONTEXT,
            10,
            20,
            { capabilityKey: "routine.summary.read", scope: "ASSIGNED" },
            deps,
        )).resolves.toEqual(routineSummaryGrant);

        await expect(addAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "routine.reference.read", scope: "OWN" },
            deps,
        )).resolves.toEqual(routineReferenceGrant);
        await expect(removeAuthorizationAdministrationUserGrant(
            ADMIN_CONTEXT,
            7,
            { capabilityKey: "routine.reference.read", scope: "OWN" },
            deps,
        )).resolves.toEqual(routineReferenceGrant);

        expect(auditAppendMock).toHaveBeenCalledTimes(16);
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

        const emailGrant = teamGrant({ capabilityKey: "email.request.create" });
        const emailRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(emailGrant),
            createTeamGrant: vi.fn().mockResolvedValue(emailGrant),
            deleteTeamGrant: vi.fn().mockResolvedValue(emailGrant),
        });
        await expect(
            addAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "email.request.create", scope: "ALL" },
                dependencies(emailRepo, transactionRunner),
            ),
        ).resolves.toEqual(emailGrant);
        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "email.request.create", scope: "ALL" },
                dependencies(emailRepo, transactionRunner),
            ),
        ).resolves.toEqual(emailGrant);
        expect(transactionRunner).toHaveBeenCalledTimes(2);
        expect(auditAppendMock).toHaveBeenCalledTimes(2);
    });

    it("allows Team lifecycle changes for affected Email Request grants", async () => {
        const disabled = team({ isActive: false });
        const updateTeam = vi.fn().mockResolvedValue(disabled);
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            listMembershipsForTeam: vi.fn().mockResolvedValue([{
                teamId: 10,
                userId: 7,
                teamRoleId: null,
                role: null,
            }]),
            listTeamGrants: vi.fn().mockResolvedValue([
                teamGrant({ capabilityKey: "email.request.create", scope: "ALL" }),
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
        ).resolves.toEqual(disabled);
        expect(updateTeam).toHaveBeenCalledOnce();
    });

    it("does not block Team lifecycle changes when no membership can receive Team grants", async () => {
        const disabled = team({ isActive: false });
        const updateTeam = vi.fn().mockResolvedValue(disabled);
        const listTeamGrants = vi.fn().mockResolvedValue([
            teamGrant({ capabilityKey: "email.request.create", scope: "ALL" }),
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
                roleGrant({ capabilityKey: "email.request.create", scope: "ALL" }),
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
            roleGrant({ capabilityKey: "email.request.create", scope: "ALL" }),
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

    it("allows membership and TeamRole lifecycle changes for Email Request grants", async () => {
        const membership = { teamId: 10, userId: 7, teamRoleId: null };
        const membershipCreate = vi.fn().mockResolvedValue(membership);
        const membershipRepo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findUserById: vi.fn().mockResolvedValue({ id: 7 }),
            findMembership: vi.fn().mockResolvedValue(null),
            listTeamGrants: vi.fn().mockResolvedValue([
                teamGrant({ capabilityKey: "email.request.create", scope: "ALL" }),
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
        ).resolves.toEqual(membership);
        expect(membershipCreate).toHaveBeenCalledOnce();

        const disabledRole = role({ isActive: false });
        const roleUpdate = vi.fn().mockResolvedValue(disabledRole);
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
                roleGrant({ capabilityKey: "email.request.create", scope: "ALL" }),
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
        ).resolves.toEqual(disabledRole);
        expect(roleUpdate).toHaveBeenCalledOnce();
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

    it("allows ordinary grant removal for a Routine default-policy capability", async () => {
        const grant = teamGrant({ capabilityKey: "routine.task.read" });
        const deleteTeamGrant = vi.fn().mockResolvedValue(grant);
        const repo = repository({
            findTeamById: vi.fn().mockResolvedValue(team()),
            findTeamGrant: vi.fn().mockResolvedValue(grant),
            deleteTeamGrant,
        });

        await expect(
            removeAuthorizationAdministrationTeamGrant(
                ADMIN_CONTEXT,
                10,
                { capabilityKey: "routine.task.read", scope: "ALL" },
                dependencies(repo),
            ),
        ).resolves.toEqual(grant);
        expect(repo.findTeamGrant).toHaveBeenCalled();
        expect(deleteTeamGrant).toHaveBeenCalledWith(TX, grant);
    });
});
