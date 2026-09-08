import type { Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const AUTH_LOGIN_USER_SELECT = {
    id: true,
    email: true,
    role: true,
    isActive: true,
    tokenVersion: true,
    name: true,
    password: true,
    deletedAt: true,
    employee: {
        select: {
            status: true,
            deletedAt: true,
        },
    },
} as const satisfies Prisma.UserSelect;

const AUTH_RESOLUTION_USER_SELECT = {
    email: true,
    name: true,
    role: true,
    isActive: true,
    deletedAt: true,
    tokenVersion: true,
    employee: {
        select: { status: true, deletedAt: true },
    },
} as const satisfies Prisma.UserSelect;

const AUTH_IDENTITY_USER_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    deletedAt: true,
} as const satisfies Prisma.UserSelect;

const AUTH_RESET_USER_SELECT = {
    id: true,
    email: true,
} as const satisfies Prisma.UserSelect;

const AUTH_RECOVERY_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    isActive: true,
} as const satisfies Prisma.UserSelect;

const AUTH_LOGOUT_USER_SELECT = {
    id: true,
    email: true,
} as const satisfies Prisma.UserSelect;

export type AuthLoginAccount = Prisma.UserGetPayload<{
    select: typeof AUTH_LOGIN_USER_SELECT;
}>;

export type AuthResolutionAccount = Prisma.UserGetPayload<{
    select: typeof AUTH_RESOLUTION_USER_SELECT;
}>;

export type AuthAccountIdentity = Prisma.UserGetPayload<{
    select: typeof AUTH_IDENTITY_USER_SELECT;
}>;

export type AuthResetAccount = Prisma.UserGetPayload<{
    select: typeof AUTH_RESET_USER_SELECT;
}>;

export type AuthRecoveryAccount = Prisma.UserGetPayload<{
    select: typeof AUTH_RECOVERY_USER_SELECT;
}>;

export type AuthLogoutAccount = Prisma.UserGetPayload<{
    select: typeof AUTH_LOGOUT_USER_SELECT;
}>;

export async function findLoginAccount(email: string): Promise<AuthLoginAccount | null> {
    return prisma.user.findUnique({
        where: { email },
        select: AUTH_LOGIN_USER_SELECT,
    });
}

export async function findAccountForResolution(userId: number): Promise<AuthResolutionAccount | null> {
    return prisma.user.findUnique({
        where: { id: userId },
        select: AUTH_RESOLUTION_USER_SELECT,
    });
}

export async function findAccountIdentityById(
    userId: number,
): Promise<AuthAccountIdentity | null> {
    return prisma.user.findUnique({
        where: { id: userId },
        select: AUTH_IDENTITY_USER_SELECT,
    });
}

export async function findAccountForLogout(userId: number): Promise<AuthLogoutAccount | null> {
    return prisma.user.findUnique({
        where: { id: userId },
        select: AUTH_LOGOUT_USER_SELECT,
    });
}

export async function findAccountForReset(email: string): Promise<AuthResetAccount | null> {
    return prisma.user.findUnique({
        where: { email },
        select: AUTH_RESET_USER_SELECT,
    });
}

export async function findAccountForRecovery(email: string): Promise<AuthRecoveryAccount | null> {
    return prisma.user.findUnique({
        where: { email },
        select: AUTH_RECOVERY_USER_SELECT,
    });
}

export async function findAccountByEmail(email: string): Promise<{ id: number } | null> {
    return prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
}

export interface CreateAuthAccountInput {
    name: string;
    email: string;
    password: string;
    role: Role;
    employeeId: number;
}

export async function createAuthAccount(
    tx: Prisma.TransactionClient,
    input: CreateAuthAccountInput,
): Promise<{ id: number; name: string; email: string; role: Role }> {
    return tx.user.create({
        data: {
            name: input.name,
            email: input.email,
            password: input.password,
            role: input.role,
            isActive: true,
            employeeId: input.employeeId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });
}

export async function updatePasswordAndIncrementTokenVersion(
    tx: Prisma.TransactionClient,
    userId: number,
    password: string,
): Promise<void> {
    await tx.user.update({
        where: { id: userId },
        data: {
            password,
            tokenVersion: { increment: 1 },
        },
    });
}

export async function updateAccountForEmployeeLifecycle(
    tx: Prisma.TransactionClient,
    input: {
        accountId: number;
        deactivating: boolean;
        identity: { name?: string; email?: string };
    },
): Promise<void> {
    await tx.user.update({
        where: { id: input.accountId },
        data: input.deactivating
            ? { ...input.identity, isActive: false, tokenVersion: { increment: 1 } }
            : {
                ...input.identity,
                isActive: true,
                deletedAt: null,
                tokenVersion: { increment: 1 },
            },
    });
}

export async function synchronizeAccountIdentity(
    tx: Prisma.TransactionClient,
    accountId: number,
    identity: { name?: string; email?: string },
): Promise<void> {
    if (Object.keys(identity).length === 0) return;
    await tx.user.update({ where: { id: accountId }, data: identity });
}
