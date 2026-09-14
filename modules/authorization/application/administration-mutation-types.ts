import type { Prisma } from "@prisma/client";

import type { AuthorizationAdministrationPrincipal } from "./administration-types";

export interface AuthorizationAdministrationMutationContext {
    readonly principal: AuthorizationAdministrationPrincipal;
    readonly userEmail?: string | null;
    readonly ipAddress?: string | null;
    readonly userAgent?: string | null;
}

export interface AuthorizationAdministrationMutationActor {
    readonly userId: number;
    readonly userEmail: string | null;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
}

export interface AuthorizationAdministrationMutationTeam {
    readonly id: number;
    readonly key: string;
    readonly name: string;
    readonly description: string | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface AuthorizationAdministrationMutationTeamRole {
    readonly id: number;
    readonly teamId: number;
    readonly key: string;
    readonly name: string;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface AuthorizationAdministrationMutationUser {
    readonly id: number;
}

export interface AuthorizationAdministrationMutationMembership {
    readonly teamId: number;
    readonly userId: number;
    readonly teamRoleId: number | null;
    readonly role: AuthorizationAdministrationMutationTeamRole | null;
}

export interface AuthorizationAdministrationMutationTeamGrant {
    readonly teamId: number;
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationAdministrationMutationTeamRoleGrant {
    readonly teamRoleId: number;
    readonly teamId: number;
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationAdministrationMutationUserGrant {
    readonly userId: number;
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationAdministrationMutationRepository {
    findTeamById(
        tx: Prisma.TransactionClient,
        teamId: number,
    ): Promise<AuthorizationAdministrationMutationTeam | null>;
    findTeamByKey(
        tx: Prisma.TransactionClient,
        key: string,
    ): Promise<AuthorizationAdministrationMutationTeam | null>;
    createTeam(
        tx: Prisma.TransactionClient,
        input: {
            readonly key: string;
            readonly name: string;
            readonly description: string | null;
        },
    ): Promise<AuthorizationAdministrationMutationTeam>;
    updateTeam(
        tx: Prisma.TransactionClient,
        teamId: number,
        input: {
            readonly name: string;
            readonly description: string | null;
            readonly isActive: boolean;
        },
    ): Promise<AuthorizationAdministrationMutationTeam>;

    findTeamRoleById(
        tx: Prisma.TransactionClient,
        teamRoleId: number,
    ): Promise<AuthorizationAdministrationMutationTeamRole | null>;
    findTeamRoleByTeamAndKey(
        tx: Prisma.TransactionClient,
        teamId: number,
        key: string,
    ): Promise<AuthorizationAdministrationMutationTeamRole | null>;
    createTeamRole(
        tx: Prisma.TransactionClient,
        input: {
            readonly teamId: number;
            readonly key: string;
            readonly name: string;
        },
    ): Promise<AuthorizationAdministrationMutationTeamRole>;
    updateTeamRole(
        tx: Prisma.TransactionClient,
        teamRoleId: number,
        input: {
            readonly name: string;
            readonly isActive: boolean;
        },
    ): Promise<AuthorizationAdministrationMutationTeamRole>;

    findUserById(
        tx: Prisma.TransactionClient,
        userId: number,
    ): Promise<AuthorizationAdministrationMutationUser | null>;
    findMembership(
        tx: Prisma.TransactionClient,
        teamId: number,
        userId: number,
    ): Promise<AuthorizationAdministrationMutationMembership | null>;
    listMembershipsForTeam(
        tx: Prisma.TransactionClient,
        teamId: number,
    ): Promise<readonly AuthorizationAdministrationMutationMembership[]>;
    createMembership(
        tx: Prisma.TransactionClient,
        input: {
            readonly teamId: number;
            readonly userId: number;
            readonly teamRoleId: number | null;
        },
    ): Promise<AuthorizationAdministrationMutationMembership>;
    updateMembershipRole(
        tx: Prisma.TransactionClient,
        teamId: number,
        userId: number,
        teamRoleId: number | null,
    ): Promise<AuthorizationAdministrationMutationMembership>;
    deleteMembership(
        tx: Prisma.TransactionClient,
        teamId: number,
        userId: number,
    ): Promise<AuthorizationAdministrationMutationMembership>;

    listTeamGrants(
        tx: Prisma.TransactionClient,
        teamId: number,
    ): Promise<readonly AuthorizationAdministrationMutationTeamGrant[]>;
    listTeamRoleGrantsForTeam(
        tx: Prisma.TransactionClient,
        teamId: number,
    ): Promise<readonly AuthorizationAdministrationMutationTeamRoleGrant[]>;
    listTeamRoleGrants(
        tx: Prisma.TransactionClient,
        teamRoleId: number,
    ): Promise<readonly AuthorizationAdministrationMutationTeamRoleGrant[]>;
    findTeamGrant(
        tx: Prisma.TransactionClient,
        teamId: number,
        capabilityKey: string,
        scope: string,
    ): Promise<AuthorizationAdministrationMutationTeamGrant | null>;
    createTeamGrant(
        tx: Prisma.TransactionClient,
        input: AuthorizationAdministrationMutationTeamGrant,
    ): Promise<AuthorizationAdministrationMutationTeamGrant>;
    deleteTeamGrant(
        tx: Prisma.TransactionClient,
        input: AuthorizationAdministrationMutationTeamGrant,
    ): Promise<AuthorizationAdministrationMutationTeamGrant>;
    findTeamRoleGrant(
        tx: Prisma.TransactionClient,
        teamRoleId: number,
        capabilityKey: string,
        scope: string,
    ): Promise<AuthorizationAdministrationMutationTeamRoleGrant | null>;
    createTeamRoleGrant(
        tx: Prisma.TransactionClient,
        input: AuthorizationAdministrationMutationTeamRoleGrant,
    ): Promise<AuthorizationAdministrationMutationTeamRoleGrant>;
    deleteTeamRoleGrant(
        tx: Prisma.TransactionClient,
        input: AuthorizationAdministrationMutationTeamRoleGrant,
    ): Promise<AuthorizationAdministrationMutationTeamRoleGrant>;
    findUserGrant(
        tx: Prisma.TransactionClient,
        userId: number,
        capabilityKey: string,
        scope: string,
    ): Promise<AuthorizationAdministrationMutationUserGrant | null>;
    createUserGrant(
        tx: Prisma.TransactionClient,
        input: AuthorizationAdministrationMutationUserGrant,
    ): Promise<AuthorizationAdministrationMutationUserGrant>;
    deleteUserGrant(
        tx: Prisma.TransactionClient,
        input: AuthorizationAdministrationMutationUserGrant,
    ): Promise<AuthorizationAdministrationMutationUserGrant>;
}

export type AuthorizationAdministrationMutationTransactionRunner = <T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;
