import type { AuditAction, Prisma } from "@prisma/client";
import type { ZodType } from "zod";

import { appendAuditInTransaction } from "@/modules/audit";
import type { AuditDetails } from "@/modules/audit";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";

import {
    assertAuthorizationAdministrationAccess,
} from "./administration";
import {
    buildCapabilityAdministrationCatalog,
} from "./administration-catalog";
import type {
    AuthorizationAdministrationMutationActor,
    AuthorizationAdministrationMutationContext,
    AuthorizationAdministrationMutationMembership,
    AuthorizationAdministrationMutationRepository,
    AuthorizationAdministrationMutationTeam,
    AuthorizationAdministrationMutationTeamGrant,
    AuthorizationAdministrationMutationTeamRole,
    AuthorizationAdministrationMutationTeamRoleGrant,
    AuthorizationAdministrationMutationTransactionRunner,
} from "./administration-mutation-types";
import {
    addAuthorizationTeamMemberSchema,
    authorizationCapabilityGrantSchema,
    changeAuthorizationTeamMemberRoleSchema,
    createAuthorizationTeamRoleSchema,
    createAuthorizationTeamSchema,
    isSafeAdministrationIdentifier,
    updateAuthorizationTeamRoleSchema,
    updateAuthorizationTeamSchema,
    type AddAuthorizationTeamMemberInput,
    type AuthorizationCapabilityGrantInput,
    type ChangeAuthorizationTeamMemberRoleInput,
    type CreateAuthorizationTeamInput,
    type CreateAuthorizationTeamRoleInput,
    type UpdateAuthorizationTeamInput,
    type UpdateAuthorizationTeamRoleInput,
} from "./administration-mutation-schemas";
import {
    AuthorizationAdministrationAccessError,
    AuthorizationAdministrationMutationError,
    type AuthorizationAdministrationMutationErrorDetails,
} from "./errors";
import {
    CapabilityGrantValidationError,
    validateCapabilityGrant,
    type ValidatedCapabilityGrant,
} from "./grant-validation";
import { authorizationAdministrationMutationRepository } from "../infrastructure/persistence/authorization-administration-mutation-repository";

export interface AuthorizationAdministrationMutationDependencies {
    readonly repository?: AuthorizationAdministrationMutationRepository;
    readonly transactionRunner?: AuthorizationAdministrationMutationTransactionRunner;
}

type MutationCallback<T> = (
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    actor: AuthorizationAdministrationMutationActor,
) => Promise<T>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalContextString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function getMutationActor(
    context: AuthorizationAdministrationMutationContext,
): AuthorizationAdministrationMutationActor {
    const unknownContext: unknown = context;
    if (!isRecord(unknownContext) || !isRecord(unknownContext.principal)) {
        throw new AuthorizationAdministrationAccessError();
    }

    const principal = assertAuthorizationAdministrationAccess({
        userId: unknownContext.principal.userId,
        systemRole: unknownContext.principal.systemRole,
    });

    return Object.freeze({
        userId: principal.userId,
        userEmail: optionalContextString(unknownContext.userEmail),
        ipAddress: optionalContextString(unknownContext.ipAddress),
        userAgent: optionalContextString(unknownContext.userAgent),
    });
}

function parseMutationInput<T>(schema: ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw new AuthorizationAdministrationMutationError(
            "INVALID_INPUT",
            "Invalid Authorization Administration mutation input",
        );
    }
    return result.data;
}

function assertTargetId(value: number, label: string): void {
    if (!isSafeAdministrationIdentifier(value)) {
        throw new AuthorizationAdministrationMutationError(
            "INVALID_INPUT",
            `Invalid Authorization Administration ${label}`,
        );
    }
}

function mutationError(
    code: ConstructorParameters<typeof AuthorizationAdministrationMutationError>[0],
    message: string,
    details: AuthorizationAdministrationMutationErrorDetails = {},
): never {
    throw new AuthorizationAdministrationMutationError(code, message, details);
}

async function runMutation<T>(
    context: AuthorizationAdministrationMutationContext,
    dependencies: AuthorizationAdministrationMutationDependencies,
    callback: MutationCallback<T>,
): Promise<T> {
    const actor = getMutationActor(context);
    const repository = dependencies.repository
        ?? authorizationAdministrationMutationRepository;
    const transactionRunner = dependencies.transactionRunner
        ?? ((operation) => runSerializableTransaction(operation));

    try {
        return await transactionRunner((tx) => callback(tx, repository, actor));
    } catch (error) {
        if (error instanceof AuthorizationAdministrationMutationError) {
            throw error;
        }
        if (hasPrismaErrorCode(error, "P2002")) {
            mutationError("CONFLICT", "Authorization Administration state conflicts with another change");
        }
        if (hasPrismaErrorCode(error, "P2025")) {
            mutationError("NOT_FOUND", "Authorization Administration target was not found");
        }
        if (hasPrismaErrorCode(error, "P2003")) {
            mutationError("CONFLICT", "Authorization Administration relationship is no longer valid");
        }
        throw error;
    }
}

async function appendAuthorizationAudit(
    tx: Prisma.TransactionClient,
    actor: AuthorizationAdministrationMutationActor,
    action: AuditAction,
    entityType: string,
    entityId: number,
    details: AuditDetails,
): Promise<void> {
    await appendAuditInTransaction(tx, {
        action,
        entityType,
        entityId,
        userId: actor.userId,
        userEmail: actor.userEmail,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        details,
    });
}

function mutationDetails(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    metadata: Record<string, unknown>,
): AuditDetails {
    return {
        before: before ?? undefined,
        after: after ?? undefined,
        metadata,
    };
}

function notFound(label: string, details: AuthorizationAdministrationMutationErrorDetails = {}): never {
    return mutationError("NOT_FOUND", `${label} was not found`, details);
}

function conflict(label: string, details: AuthorizationAdministrationMutationErrorDetails = {}): never {
    return mutationError("CONFLICT", `${label} conflicts with existing configuration`, details);
}

async function requireTeam(
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    teamId: number,
): Promise<AuthorizationAdministrationMutationTeam> {
    const team = await repository.findTeamById(tx, teamId);
    return team ?? notFound("Team", { teamId });
}

async function requireTeamRoleInTeam(
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    teamId: number,
    teamRoleId: number,
): Promise<AuthorizationAdministrationMutationTeamRole> {
    const role = await repository.findTeamRoleById(tx, teamRoleId);
    if (role === null) return notFound("TeamRole", { teamRoleId, teamId });
    if (role.teamId !== teamId) {
        return mutationError(
            "TEAM_ROLE_TEAM_MISMATCH",
            "TeamRole does not belong to the requested Team",
            { teamId, teamRoleId },
        );
    }
    return role;
}

async function requireUser(
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    userId: number,
): Promise<void> {
    const user = await repository.findUserById(tx, userId);
    if (user === null) notFound("User", { userId });
}

function catalogByKey(): ReadonlyMap<string, ReturnType<typeof buildCapabilityAdministrationCatalog>[number]> {
    return new Map(
        buildCapabilityAdministrationCatalog().map((capability) => [
            capability.key,
            capability,
        ] as const),
    );
}

function validateOrdinaryGrant(
    input: AuthorizationCapabilityGrantInput,
    source: "TEAM" | "TEAM_ROLE" | "USER",
): ValidatedCapabilityGrant {
    let validated: ValidatedCapabilityGrant;
    try {
        validated = validateCapabilityGrant(input);
    } catch (error) {
        if (!(error instanceof CapabilityGrantValidationError)) throw error;
        return mutationError(
            error.code,
            error.message,
            { capabilityKey: input.capabilityKey, scope: input.scope },
        );
    }

    if (source === "USER" && validated.scope === "TEAM") {
        return mutationError(
            "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
            "A direct User grant cannot carry TEAM scope without an originating Team",
            { capabilityKey: validated.capabilityKey, scope: validated.scope },
        );
    }

    const capability = catalogByKey().get(validated.capabilityKey);
    if (capability === undefined) {
        return mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Capability administration readiness is not defined",
            { capabilityKey: validated.capabilityKey, scope: validated.scope },
        );
    }
    if (
        capability.administrativelyGrantable !== true
        || capability.administrativeStatus !== "GRANTABLE"
    ) {
        if (capability.administrativeStatus === "POLICY_ACTIVATION_REQUIRED") {
            return mutationError(
                "CAPABILITY_POLICY_ACTIVATION_REQUIRED",
                "Capability requires explicit policy activation before ordinary mutation",
                { capabilityKey: validated.capabilityKey, scope: validated.scope },
            );
        }
        if (capability.administrativeStatus === "DEFERRED") {
            return mutationError(
                "CAPABILITY_DEFERRED",
                "Capability administration is deferred",
                { capabilityKey: validated.capabilityKey, scope: validated.scope },
            );
        }
        return mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Capability is not administratively grantable",
            { capabilityKey: validated.capabilityKey, scope: validated.scope },
        );
    }

    return validated;
}

function validatePersistedGrantForImpact(
    grant: {
        readonly capabilityKey: string;
        readonly scope: string;
    },
    source: "TEAM" | "TEAM_ROLE" | "USER",
    details: AuthorizationAdministrationMutationErrorDetails,
): void {
    let validated: ValidatedCapabilityGrant;
    try {
        validated = validateCapabilityGrant(grant);
    } catch (error) {
        if (!(error instanceof CapabilityGrantValidationError)) throw error;
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Affected persisted authorization configuration is invalid",
            { ...details, capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }

    if (source === "USER" && validated.scope === "TEAM") {
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Affected direct User configuration has no valid Team origin",
            { ...details, capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }

    const capability = catalogByKey().get(validated.capabilityKey);
    if (capability === undefined) {
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Affected capability administration readiness is not defined",
            { ...details, capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }
    if (
        capability.administrativelyGrantable !== true
        || capability.administrativeStatus !== "GRANTABLE"
    ) {
        if (capability.administrativeStatus === "POLICY_ACTIVATION_REQUIRED") {
            mutationError(
                "CAPABILITY_POLICY_ACTIVATION_REQUIRED",
                "Affected capability requires explicit policy activation",
                { ...details, capabilityKey: grant.capabilityKey, scope: grant.scope },
            );
        }
        if (capability.administrativeStatus === "DEFERRED") {
            mutationError(
                "CAPABILITY_DEFERRED",
                "Affected capability administration is deferred",
                { ...details, capabilityKey: grant.capabilityKey, scope: grant.scope },
            );
        }
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Affected capability is not administratively grantable",
            { ...details, capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }
}

function assertTeamGrantOrigin(
    grant: AuthorizationAdministrationMutationTeamGrant,
    teamId: number,
): void {
    if (grant.teamId !== teamId) {
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Affected Team grant has an invalid origin",
            { teamId, capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }
}

function assertTeamRoleGrantOrigin(
    grant: AuthorizationAdministrationMutationTeamRoleGrant,
    teamId: number,
    teamRoleId?: number,
): void {
    if (grant.teamId !== teamId || (teamRoleId !== undefined && grant.teamRoleId !== teamRoleId)) {
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Affected TeamRole grant has an invalid origin",
            {
                teamId,
                teamRoleId: teamRoleId ?? grant.teamRoleId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            },
        );
    }
}

async function assertTeamApplicabilitySafe(
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    teamId: number,
): Promise<void> {
    const [teamGrants, roleGrants, memberships] = await Promise.all([
        repository.listTeamGrants(tx, teamId),
        repository.listTeamRoleGrantsForTeam(tx, teamId),
        repository.listMembershipsForTeam(tx, teamId),
    ]);
    for (const membership of memberships) {
        assertMembershipIntegrity(membership, teamId);
    }
    for (const grant of teamGrants) {
        assertTeamGrantOrigin(grant, teamId);
        validatePersistedGrantForImpact(grant, "TEAM", { teamId });
    }
    for (const grant of roleGrants) {
        assertTeamRoleGrantOrigin(grant, teamId);
        validatePersistedGrantForImpact(grant, "TEAM_ROLE", {
            teamId,
            teamRoleId: grant.teamRoleId,
        });
    }
}

async function assertTeamRoleApplicabilitySafe(
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    teamId: number,
    teamRoleId: number,
): Promise<void> {
    const [grants, memberships] = await Promise.all([
        repository.listTeamRoleGrants(tx, teamRoleId),
        repository.listMembershipsForTeam(tx, teamId),
    ]);
    for (const membership of memberships) {
        if (
            membership.teamRoleId === teamRoleId
            || membership.role?.id === teamRoleId
        ) {
            assertMembershipIntegrity(membership, teamId);
        }
    }
    for (const grant of grants) {
        assertTeamRoleGrantOrigin(grant, teamId, teamRoleId);
        validatePersistedGrantForImpact(grant, "TEAM_ROLE", {
            teamId,
            teamRoleId,
        });
    }
}

async function assertMembershipApplicabilitySafe(
    tx: Prisma.TransactionClient,
    repository: AuthorizationAdministrationMutationRepository,
    team: AuthorizationAdministrationMutationTeam,
    roles: readonly (AuthorizationAdministrationMutationTeamRole | null)[],
    includeTeamGrants: boolean,
): Promise<void> {
    if (!team.isActive) return;

    if (includeTeamGrants) {
        const teamGrants = await repository.listTeamGrants(tx, team.id);
        for (const grant of teamGrants) {
            assertTeamGrantOrigin(grant, team.id);
            validatePersistedGrantForImpact(grant, "TEAM", { teamId: team.id });
        }
    }

    const uniqueRoleIds = new Set<number>();
    for (const role of roles) {
        if (role === null || !role.isActive || uniqueRoleIds.has(role.id)) continue;
        uniqueRoleIds.add(role.id);
        await assertTeamRoleApplicabilitySafe(tx, repository, team.id, role.id);
    }
}

function assertMembershipIntegrity(
    membership: AuthorizationAdministrationMutationMembership,
    teamId: number,
): void {
    const roleMatches = membership.role === null
        ? membership.teamRoleId === null
        : membership.teamRoleId === membership.role.id
            && membership.role.teamId === teamId;
    if (membership.teamId !== teamId || !roleMatches) {
        mutationError(
            "INVALID_AUTHORIZATION_CONFIGURATION",
            "Persisted TeamMembership has an invalid TeamRole relationship",
            {
                teamId,
                teamRoleId: membership.teamRoleId ?? membership.role?.id,
                userId: membership.userId,
            },
        );
    }
}

function teamSnapshot(team: AuthorizationAdministrationMutationTeam): Record<string, unknown> {
    return {
        name: team.name,
        description: team.description,
        isActive: team.isActive,
    };
}

function roleSnapshot(role: AuthorizationAdministrationMutationTeamRole): Record<string, unknown> {
    return {
        teamId: role.teamId,
        key: role.key,
        name: role.name,
        isActive: role.isActive,
    };
}

function membershipSnapshot(
    membership: Pick<AuthorizationAdministrationMutationMembership, "teamId" | "userId" | "teamRoleId">,
): Record<string, unknown> {
    return {
        teamId: membership.teamId,
        userId: membership.userId,
        teamRoleId: membership.teamRoleId,
    };
}

function grantSnapshot(
    grant: { readonly capabilityKey: string; readonly scope: string } | null,
): Record<string, unknown> {
    return grant === null
        ? { present: false }
        : {
            present: true,
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
        };
}

export async function createAuthorizationAdministrationTeam(
    context: AuthorizationAdministrationMutationContext,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeam> {
    const data: CreateAuthorizationTeamInput = parseMutationInput(
        createAuthorizationTeamSchema,
        input,
    );
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        if (await repository.findTeamByKey(tx, data.key) !== null) {
            return conflict("Team");
        }
        const team = await repository.createTeam(tx, {
            key: data.key,
            name: data.name,
            description: data.description ?? null,
        });
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_CREATE",
            "Team",
            team.id,
            mutationDetails(
                null,
                { key: team.key, ...teamSnapshot(team) },
                { teamKey: team.key },
            ),
        );
        return team;
    });
}

export async function updateAuthorizationAdministrationTeam(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeam> {
    assertTargetId(teamId, "Team identifier");
    const data: UpdateAuthorizationTeamInput = parseMutationInput(
        updateAuthorizationTeamSchema,
        input,
    );
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        const current = await requireTeam(tx, repository, teamId);
        const next = {
            name: data.name ?? current.name,
            description: data.description === undefined
                ? current.description
                : data.description,
            isActive: data.isActive ?? current.isActive,
        };
        if (
            current.name === next.name
            && current.description === next.description
            && current.isActive === next.isActive
        ) {
            return mutationError("NO_STATE_CHANGE", "Team update does not change state", { teamId });
        }
        if (current.isActive !== next.isActive) {
            await assertTeamApplicabilitySafe(tx, repository, teamId);
        }
        const updated = await repository.updateTeam(tx, teamId, next);
        await appendAuthorizationAudit(
            tx,
            actor,
            current.isActive && !updated.isActive ? "TEAM_DISABLE" : "TEAM_UPDATE",
            "Team",
            updated.id,
            mutationDetails(
                teamSnapshot(current),
                teamSnapshot(updated),
                { teamKey: updated.key },
            ),
        );
        return updated;
    });
}

export async function createAuthorizationAdministrationTeamRole(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeamRole> {
    assertTargetId(teamId, "Team identifier");
    const data: CreateAuthorizationTeamRoleInput = parseMutationInput(
        createAuthorizationTeamRoleSchema,
        input,
    );
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireTeam(tx, repository, teamId);
        if (await repository.findTeamRoleByTeamAndKey(tx, teamId, data.key) !== null) {
            return conflict("TeamRole", { teamId });
        }
        const role = await repository.createTeamRole(tx, {
            teamId,
            key: data.key,
            name: data.name,
        });
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_ROLE_CREATE",
            "TeamRole",
            role.id,
            mutationDetails(
                null,
                roleSnapshot(role),
                { teamId, roleKey: role.key },
            ),
        );
        return role;
    });
}

export async function updateAuthorizationAdministrationTeamRole(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    teamRoleId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeamRole> {
    assertTargetId(teamId, "Team identifier");
    assertTargetId(teamRoleId, "TeamRole identifier");
    const data: UpdateAuthorizationTeamRoleInput = parseMutationInput(
        updateAuthorizationTeamRoleSchema,
        input,
    );
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireTeam(tx, repository, teamId);
        const current = await requireTeamRoleInTeam(tx, repository, teamId, teamRoleId);
        const next = {
            name: data.name ?? current.name,
            isActive: data.isActive ?? current.isActive,
        };
        if (current.name === next.name && current.isActive === next.isActive) {
            return mutationError("NO_STATE_CHANGE", "TeamRole update does not change state", { teamId, teamRoleId });
        }
        if (current.isActive !== next.isActive) {
            const team = await requireTeam(tx, repository, teamId);
            if (team.isActive) {
                await assertTeamRoleApplicabilitySafe(tx, repository, teamId, teamRoleId);
            }
        }
        const updated = await repository.updateTeamRole(tx, teamRoleId, next);
        await appendAuthorizationAudit(
            tx,
            actor,
            current.isActive && !updated.isActive ? "TEAM_ROLE_DISABLE" : "TEAM_ROLE_UPDATE",
            "TeamRole",
            updated.id,
            mutationDetails(
                roleSnapshot(current),
                roleSnapshot(updated),
                { teamId, roleKey: updated.key },
            ),
        );
        return updated;
    });
}

export async function addAuthorizationAdministrationTeamMember(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationMembership> {
    assertTargetId(teamId, "Team identifier");
    const data: AddAuthorizationTeamMemberInput = parseMutationInput(
        addAuthorizationTeamMemberSchema,
        input,
    );
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        const team = await requireTeam(tx, repository, teamId);
        await requireUser(tx, repository, data.userId);
        const existing = await repository.findMembership(tx, teamId, data.userId);
        if (existing !== null) {
            return mutationError("DUPLICATE_MEMBERSHIP", "TeamMembership already exists", { teamId, userId: data.userId });
        }
        const role = data.teamRoleId === undefined || data.teamRoleId === null
            ? null
            : await requireTeamRoleInTeam(tx, repository, teamId, data.teamRoleId);
        await assertMembershipApplicabilitySafe(tx, repository, team, [role], true);
        const membership = await repository.createMembership(tx, {
            teamId,
            userId: data.userId,
            teamRoleId: role?.id ?? null,
        });
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_MEMBER_ADD",
            "Team",
            teamId,
            mutationDetails(
                null,
                membershipSnapshot(membership),
                { teamId, targetUserId: data.userId },
            ),
        );
        return membership;
    });
}

export async function removeAuthorizationAdministrationTeamMember(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    userId: number,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationMembership> {
    assertTargetId(teamId, "Team identifier");
    assertTargetId(userId, "User identifier");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        const team = await requireTeam(tx, repository, teamId);
        const membership = await repository.findMembership(tx, teamId, userId);
        if (membership === null) return notFound("TeamMembership", { teamId, userId });
        assertMembershipIntegrity(membership, teamId);
        await assertMembershipApplicabilitySafe(tx, repository, team, [membership.role], true);
        const removed = await repository.deleteMembership(tx, teamId, userId);
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_MEMBER_REMOVE",
            "Team",
            teamId,
            mutationDetails(
                membershipSnapshot(membership),
                null,
                { teamId, targetUserId: userId },
            ),
        );
        return removed;
    });
}

export async function changeAuthorizationAdministrationTeamMemberRole(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    userId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationMembership> {
    assertTargetId(teamId, "Team identifier");
    assertTargetId(userId, "User identifier");
    const data: ChangeAuthorizationTeamMemberRoleInput = parseMutationInput(
        changeAuthorizationTeamMemberRoleSchema,
        input,
    );
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        const team = await requireTeam(tx, repository, teamId);
        const membership = await repository.findMembership(tx, teamId, userId);
        if (membership === null) return notFound("TeamMembership", { teamId, userId });
        assertMembershipIntegrity(membership, teamId);
        if (membership.teamRoleId === data.teamRoleId) {
            return mutationError("NO_STATE_CHANGE", "TeamMembership role does not change", { teamId, userId });
        }
        const newRole = data.teamRoleId === null
            ? null
            : await requireTeamRoleInTeam(tx, repository, teamId, data.teamRoleId);
        await assertMembershipApplicabilitySafe(tx, repository, team, [membership.role, newRole], false);
        const updated = await repository.updateMembershipRole(
            tx,
            teamId,
            userId,
            newRole?.id ?? null,
        );
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_MEMBER_ROLE_CHANGE",
            "Team",
            teamId,
            mutationDetails(
                { teamRoleId: membership.teamRoleId },
                { teamRoleId: updated.teamRoleId },
                { teamId, targetUserId: userId },
            ),
        );
        return updated;
    });
}

export async function addAuthorizationAdministrationTeamGrant(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeamGrant> {
    assertTargetId(teamId, "Team identifier");
    const data: AuthorizationCapabilityGrantInput = parseMutationInput(
        authorizationCapabilityGrantSchema,
        input,
    );
    const validated = validateOrdinaryGrant(data, "TEAM");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireTeam(tx, repository, teamId);
        if (await repository.findTeamGrant(tx, teamId, validated.capabilityKey, validated.scope) !== null) {
            return mutationError("DUPLICATE_GRANT", "Team capability grant already exists", { teamId, capabilityKey: validated.capabilityKey, scope: validated.scope });
        }
        const grant = await repository.createTeamGrant(tx, {
            teamId,
            capabilityKey: validated.capabilityKey,
            scope: validated.scope,
        });
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_CAPABILITY_GRANT_UPDATE",
            "Team",
            teamId,
            mutationDetails(
                grantSnapshot(null),
                grantSnapshot(grant),
                { teamId, capabilityKey: grant.capabilityKey, scope: grant.scope },
            ),
        );
        return grant;
    });
}

export async function removeAuthorizationAdministrationTeamGrant(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeamGrant> {
    assertTargetId(teamId, "Team identifier");
    const data: AuthorizationCapabilityGrantInput = parseMutationInput(
        authorizationCapabilityGrantSchema,
        input,
    );
    const validated = validateOrdinaryGrant(data, "TEAM");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireTeam(tx, repository, teamId);
        const existing = await repository.findTeamGrant(tx, teamId, validated.capabilityKey, validated.scope);
        if (existing === null) {
            return notFound("Team capability grant", { teamId, capabilityKey: validated.capabilityKey, scope: validated.scope });
        }
        const removed = await repository.deleteTeamGrant(tx, existing);
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_CAPABILITY_GRANT_UPDATE",
            "Team",
            teamId,
            mutationDetails(
                grantSnapshot(removed),
                grantSnapshot(null),
                { teamId, capabilityKey: removed.capabilityKey, scope: removed.scope },
            ),
        );
        return removed;
    });
}

export async function addAuthorizationAdministrationTeamRoleGrant(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    teamRoleId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeamRoleGrant> {
    assertTargetId(teamId, "Team identifier");
    assertTargetId(teamRoleId, "TeamRole identifier");
    const data: AuthorizationCapabilityGrantInput = parseMutationInput(
        authorizationCapabilityGrantSchema,
        input,
    );
    const validated = validateOrdinaryGrant(data, "TEAM_ROLE");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireTeamRoleInTeam(tx, repository, teamId, teamRoleId);
        if (await repository.findTeamRoleGrant(tx, teamRoleId, validated.capabilityKey, validated.scope) !== null) {
            return mutationError("DUPLICATE_GRANT", "TeamRole capability grant already exists", { teamId, teamRoleId, capabilityKey: validated.capabilityKey, scope: validated.scope });
        }
        const grant = await repository.createTeamRoleGrant(tx, {
            teamRoleId,
            teamId,
            capabilityKey: validated.capabilityKey,
            scope: validated.scope,
        });
        assertTeamRoleGrantOrigin(grant, teamId, teamRoleId);
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_ROLE_CAPABILITY_GRANT_UPDATE",
            "TeamRole",
            teamRoleId,
            mutationDetails(
                grantSnapshot(null),
                grantSnapshot(grant),
                { teamId, teamRoleId, capabilityKey: grant.capabilityKey, scope: grant.scope },
            ),
        );
        return grant;
    });
}

export async function removeAuthorizationAdministrationTeamRoleGrant(
    context: AuthorizationAdministrationMutationContext,
    teamId: number,
    teamRoleId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<AuthorizationAdministrationMutationTeamRoleGrant> {
    assertTargetId(teamId, "Team identifier");
    assertTargetId(teamRoleId, "TeamRole identifier");
    const data: AuthorizationCapabilityGrantInput = parseMutationInput(
        authorizationCapabilityGrantSchema,
        input,
    );
    const validated = validateOrdinaryGrant(data, "TEAM_ROLE");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireTeamRoleInTeam(tx, repository, teamId, teamRoleId);
        const existing = await repository.findTeamRoleGrant(tx, teamRoleId, validated.capabilityKey, validated.scope);
        if (existing === null) {
            return notFound("TeamRole capability grant", { teamId, teamRoleId, capabilityKey: validated.capabilityKey, scope: validated.scope });
        }
        assertTeamRoleGrantOrigin(existing, teamId, teamRoleId);
        const removed = await repository.deleteTeamRoleGrant(tx, existing);
        await appendAuthorizationAudit(
            tx,
            actor,
            "TEAM_ROLE_CAPABILITY_GRANT_UPDATE",
            "TeamRole",
            teamRoleId,
            mutationDetails(
                grantSnapshot(removed),
                grantSnapshot(null),
                { teamId, teamRoleId, capabilityKey: removed.capabilityKey, scope: removed.scope },
            ),
        );
        return removed;
    });
}

export async function addAuthorizationAdministrationUserGrant(
    context: AuthorizationAdministrationMutationContext,
    userId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<{ readonly userId: number; readonly capabilityKey: string; readonly scope: string }> {
    assertTargetId(userId, "User identifier");
    const data: AuthorizationCapabilityGrantInput = parseMutationInput(
        authorizationCapabilityGrantSchema,
        input,
    );
    const validated = validateOrdinaryGrant(data, "USER");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireUser(tx, repository, userId);
        if (await repository.findUserGrant(tx, userId, validated.capabilityKey, validated.scope) !== null) {
            return mutationError("DUPLICATE_GRANT", "User capability grant already exists", { userId, capabilityKey: validated.capabilityKey, scope: validated.scope });
        }
        const grant = await repository.createUserGrant(tx, {
            userId,
            capabilityKey: validated.capabilityKey,
            scope: validated.scope,
        });
        await appendAuthorizationAudit(
            tx,
            actor,
            "USER_CAPABILITY_GRANT_ADD",
            "User",
            userId,
            mutationDetails(
                grantSnapshot(null),
                grantSnapshot(grant),
                { userId, capabilityKey: grant.capabilityKey, scope: grant.scope },
            ),
        );
        return grant;
    });
}

export async function removeAuthorizationAdministrationUserGrant(
    context: AuthorizationAdministrationMutationContext,
    userId: number,
    input: unknown,
    dependencies: AuthorizationAdministrationMutationDependencies = {},
): Promise<{ readonly userId: number; readonly capabilityKey: string; readonly scope: string }> {
    assertTargetId(userId, "User identifier");
    const data: AuthorizationCapabilityGrantInput = parseMutationInput(
        authorizationCapabilityGrantSchema,
        input,
    );
    const validated = validateOrdinaryGrant(data, "USER");
    return runMutation(context, dependencies, async (tx, repository, actor) => {
        await requireUser(tx, repository, userId);
        const existing = await repository.findUserGrant(tx, userId, validated.capabilityKey, validated.scope);
        if (existing === null) {
            return notFound("User capability grant", { userId, capabilityKey: validated.capabilityKey, scope: validated.scope });
        }
        const removed = await repository.deleteUserGrant(tx, existing);
        await appendAuthorizationAudit(
            tx,
            actor,
            "USER_CAPABILITY_GRANT_REMOVE",
            "User",
            userId,
            mutationDetails(
                grantSnapshot(removed),
                grantSnapshot(null),
                { userId, capabilityKey: removed.capabilityKey, scope: removed.scope },
            ),
        );
        return removed;
    });
}
