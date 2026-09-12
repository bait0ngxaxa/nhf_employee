import type { Prisma } from "@prisma/client";

import {
    authorization,
    type AuthorizationActor,
    type AuthorizationChannel,
    type AuthorizationDecision,
    type AuthorizationScope,
} from "@/modules/authorization";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";

import { StockCapabilityDeniedError } from "./errors";
import type { StockCommandActor } from "../domain/types";

export const STOCK_MIGRATED_CAPABILITIES = [
    "stock.catalog.read",
    "stock.inventory.manage",
    "stock.request.read",
    "stock.request.create",
    "stock.request.cancel",
    "stock.request.process",
    "stock.report.export",
] as const;

export type StockMigratedCapability =
    (typeof STOCK_MIGRATED_CAPABILITIES)[number];

export type StockAuthorizationChannel = Exclude<
    AuthorizationChannel,
    "SYSTEM"
>;

export type StockAuthorizationActor = AuthorizationActor & {
    readonly channel: StockAuthorizationChannel;
};

export interface StockAuthorizationContext {
    readonly authorizationActor: StockAuthorizationActor;
}

export type StockAuthorizedCommandActor = StockCommandActor & {
    readonly authorization: StockAuthorizationContext;
};

export interface StockRequestQueryAuthorization {
    readonly userId: number;
    readonly scopes: readonly AuthorizationScope[];
}

export interface StockCapabilityOptions {
    readonly requestedScope?: "mine" | "all";
}

export interface StockCapabilityAuthorization {
    readonly actor: StockAuthorizationActor;
    readonly capability: StockMigratedCapability;
    readonly decision: AuthorizationDecision;
    readonly scopes: readonly AuthorizationScope[];
    readonly isAdministrative: boolean;
    readonly usedMigrationCompatibility: boolean;
}

const STOCK_CAPABILITY_SET = new Set<string>(
    STOCK_MIGRATED_CAPABILITIES,
);

function isStockMigratedCapability(
    capability: string,
): capability is StockMigratedCapability {
    return STOCK_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildStockAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null,
    channel: StockAuthorizationChannel,
): StockAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel,
    });
}

export function buildStockAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null,
    channel: StockAuthorizationChannel,
): StockAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildStockAuthorizationActor(
            user,
            employeeId,
            channel,
        ),
    });
}

function freezeScopes(
    scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
    return Object.freeze([...scopes]);
}

function legacyStockScopes(
    actor: StockAuthorizationActor,
    capability: StockMigratedCapability,
    options: StockCapabilityOptions,
): readonly AuthorizationScope[] | null {
    if (actor.systemRole === "ADMIN") {
        switch (capability) {
            case "stock.catalog.read":
                return ["ALL"];
            case "stock.inventory.manage":
                return actor.channel === "DASHBOARD" ? ["ALL"] : null;
            case "stock.request.read":
                return options.requestedScope === "all" ? ["ALL"] : ["OWN"];
            case "stock.request.create":
                return ["OWN"];
            case "stock.request.cancel":
            case "stock.request.process":
            case "stock.report.export":
                return capability === "stock.report.export"
                    ? (actor.channel === "DASHBOARD" ? ["ALL"] : null)
                    : ["ALL"];
        }
    }

    switch (capability) {
        case "stock.catalog.read":
            return ["ALL"];
        case "stock.request.read":
        case "stock.request.create":
        case "stock.request.cancel":
            return ["OWN"];
        case "stock.inventory.manage":
        case "stock.request.process":
        case "stock.report.export":
            return null;
    }
}

function isDashboardAdministrativeAuthorization(
    actor: StockAuthorizationActor,
    decision: AuthorizationDecision,
    usedMigrationCompatibility: boolean,
): boolean {
    return actor.channel === "DASHBOARD"
        && actor.systemRole === "ADMIN"
        && (usedMigrationCompatibility
            || decision.grants.some((grant) => grant.source.type === "SYSTEM_ROLE"));
}

function buildStockCapabilityAuthorization(
    actor: StockAuthorizationActor,
    capability: StockMigratedCapability,
    decision: AuthorizationDecision,
    options: StockCapabilityOptions,
): StockCapabilityAuthorization {
    if (!decision.allowed) {
        const legacyScopes = decision.reason === "NO_APPLICABLE_GRANT"
            ? legacyStockScopes(actor, capability, options)
            : null;
        if (legacyScopes === null) {
            throw new StockCapabilityDeniedError(
                capability,
                decision.reason,
            );
        }

        return Object.freeze({
            actor,
            capability,
            decision,
            scopes: freezeScopes(legacyScopes),
            isAdministrative: isDashboardAdministrativeAuthorization(
                actor,
                decision,
                true,
            ),
            usedMigrationCompatibility: true,
        });
    }

    return Object.freeze({
        actor,
        capability,
        decision,
        scopes: decision.scopes,
        isAdministrative: isDashboardAdministrativeAuthorization(
            actor,
            decision,
            false,
        ),
        usedMigrationCompatibility: false,
    });
}

export async function resolveStockCapabilityForMigration(
    context: StockAuthorizationContext,
    capability: string,
    options: StockCapabilityOptions = {},
): Promise<StockCapabilityAuthorization> {
    const decision = await authorization.resolve(
        context.authorizationActor,
        capability,
    );
    if (!isStockMigratedCapability(capability)) {
        throw new StockCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    return buildStockCapabilityAuthorization(
        context.authorizationActor,
        capability,
        decision,
        options,
    );
}

export async function assertStockCapabilityForMigration(
    context: StockAuthorizationContext,
    capability: string,
    options: StockCapabilityOptions = {},
): Promise<StockCapabilityAuthorization> {
    return resolveStockCapabilityForMigration(context, capability, options);
}

export async function canResolveStockCapabilityForMigration(
    context: StockAuthorizationContext,
    capability: string,
    options: StockCapabilityOptions = {},
): Promise<boolean> {
    try {
        await resolveStockCapabilityForMigration(context, capability, options);
        return true;
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) return false;
        throw error;
    }
}

interface ActiveStockUserRecord {
    readonly id: number;
    readonly role: string;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: {
        readonly id: number;
        readonly status: string;
        readonly deletedAt: Date | null;
    } | null;
}

async function findActiveStockUser(
    tx: Prisma.TransactionClient,
    actorId: number,
): Promise<ActiveStockUserRecord | null> {
    await lockUserRows(tx, [actorId]);
    return tx.user.findUnique({
        where: { id: actorId },
        select: {
            id: true,
            role: true,
            isActive: true,
            deletedAt: true,
            employee: {
                select: { id: true, status: true, deletedAt: true },
            },
        },
    });
}

function isActiveStockEmployee(
    employee: ActiveStockUserRecord["employee"],
): employee is NonNullable<ActiveStockUserRecord["employee"]> {
    return employee?.status === "ACTIVE" && employee.deletedAt === null;
}

export async function resolveStockCapabilityInTransaction(
    tx: Prisma.TransactionClient,
    actor: StockAuthorizedCommandActor,
    capability: string,
    options: StockCapabilityOptions = {},
): Promise<StockCapabilityAuthorization> {
    const requestedActor = actor.authorization.authorizationActor;
    if (requestedActor.userId !== actor.id) {
        throw new WorkforceAuthorizationError();
    }

    const user = await findActiveStockUser(tx, actor.id);
    if (!user || !user.isActive || user.deletedAt !== null) {
        throw new WorkforceAuthorizationError();
    }
    if (!isActiveStockEmployee(user.employee)) {
        throw new WorkforceAuthorizationError();
    }

    await lockEmployeeRows(tx, [user.employee.id]);
    const activeActor = buildStockAuthorizationActor(
        { id: user.id, role: user.role },
        user.employee.id,
        requestedActor.channel,
    );
    const decision = await authorization.resolveInTransaction(
        activeActor,
        capability,
        tx,
    );
    if (!isStockMigratedCapability(capability)) {
        throw new StockCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    return buildStockCapabilityAuthorization(
        activeActor,
        capability,
        decision,
        options,
    );
}
