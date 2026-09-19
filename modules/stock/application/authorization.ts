import type { Prisma } from "@prisma/client";

import {
    authorization,
    composeAuthorizationAuthority,
    type AuthorizationActor,
    type AuthorizationChannel,
    type AuthorizationDecision,
    type AuthorizationScope,
    type ComposedAuthorizationAuthority,
} from "@/modules/authorization";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";

import { StockCapabilityDeniedError } from "./errors";
import type { StockCommandActor } from "../domain/types";
import type { StockPresentationCapabilities } from "./types";

export const STOCK_CAPABILITIES = [
    "stock.catalog.read",
    "stock.inventory.manage",
    "stock.request.read",
    "stock.request.create",
    "stock.request.cancel",
    "stock.request.process",
    "stock.report.export",
] as const;

export type StockCapability = (typeof STOCK_CAPABILITIES)[number];

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
    readonly capability: StockCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
    readonly isAdministrative: boolean;
}

const STOCK_CAPABILITY_SET = new Set<string>(
    STOCK_CAPABILITIES,
);

function isStockCapability(
    capability: string,
): capability is StockCapability {
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

export function defaultStockScopes(
    _actor: StockAuthorizationActor,
    capability: StockCapability,
): readonly AuthorizationScope[] {
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
            return [];
    }
}

function buildStockCapabilityAuthorization(
    actor: StockAuthorizationActor,
    capability: StockCapability,
    authority: ComposedAuthorizationAuthority,
): StockCapabilityAuthorization {
    if (!authority.allowed) {
        throw new StockCapabilityDeniedError(
            capability,
            authority.configuredDecision.reason,
        );
    }

    return Object.freeze({
        actor,
        capability,
        decision: authority.configuredDecision,
        defaultScopes: authority.defaultScopes,
        scopes: authority.scopes,
        // The legacy ADMIN/SystemRole projection is comparison-only. Normal
        // production authority never derives this metadata from identity.
        isAdministrative: false,
    });
}

function composeStockCapabilityAuthorization(
    actor: StockAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): StockCapabilityAuthorization {
    if (!isStockCapability(capability)) {
        throw new StockCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    const authority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultStockScopes(actor, capability),
        decision,
    );
    return buildStockCapabilityAuthorization(actor, capability, authority);
}

function getStockPresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: StockCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted Stock capability: ${capability}`,
        );
    }
    return decision;
}

function projectStockCapabilityDecision(
    actor: StockAuthorizationActor,
    capability: StockCapability,
    decision: AuthorizationDecision,
): readonly AuthorizationScope[] | null {
    try {
        return composeStockCapabilityAuthorization(
            actor,
            capability,
            decision,
        ).scopes;
    } catch (error) {
        if (
            error instanceof StockCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return null;
        }
        throw error;
    }
}

function hasStockScope(
    scopes: readonly AuthorizationScope[] | null,
    scope: AuthorizationScope,
): boolean {
    return scopes?.includes(scope) === true || scopes?.includes("ALL") === true;
}

export async function getStockPresentationCapabilities(
    context: StockAuthorizationContext,
): Promise<StockPresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(
        actor,
        STOCK_CAPABILITIES,
    );

    const project = (
        capability: StockCapability,
    ): readonly AuthorizationScope[] | null =>
        projectStockCapabilityDecision(
            actor,
            capability,
            getStockPresentationDecision(decisions, capability),
        );

    const readScopes = project("stock.request.read");
    const cancelScopes = project("stock.request.cancel");

    return Object.freeze({
        canReadCatalog: hasStockScope(
            project("stock.catalog.read"),
            "ALL",
        ),
        canReadOwnRequests: hasStockScope(readScopes, "OWN"),
        canReadAllRequests: hasStockScope(readScopes, "ALL"),
        canCreateRequests: hasStockScope(
            project("stock.request.create"),
            "OWN",
        ),
        canCancelOwnRequests: hasStockScope(cancelScopes, "OWN"),
        canCancelAnyRequests: hasStockScope(cancelScopes, "ALL"),
        canProcessRequests: hasStockScope(
            project("stock.request.process"),
            "ALL",
        ),
        canManageInventory: hasStockScope(
            project("stock.inventory.manage"),
            "ALL",
        ),
        canExportReports: hasStockScope(
            project("stock.report.export"),
            "ALL",
        ),
    });
}

export async function resolveStockCapability(
    context: StockAuthorizationContext,
    capability: string,
    options: StockCapabilityOptions = {},
): Promise<StockCapabilityAuthorization> {
    // requestedScope describes the caller's query view, not authorization authority.
    void options;
    const decision = await authorization.resolve(
        context.authorizationActor,
        capability,
    );
    return composeStockCapabilityAuthorization(
        context.authorizationActor,
        capability,
        decision,
    );
}

export async function assertStockCapability(
    context: StockAuthorizationContext,
    capability: string,
    options: StockCapabilityOptions = {},
): Promise<StockCapabilityAuthorization> {
    return resolveStockCapability(context, capability, options);
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
    // requestedScope describes the caller's query view, not authorization authority.
    void options;
    const requestedActor = actor.authorization.authorizationActor;
    if (requestedActor.userId !== actor.id) {
        throw new WorkforceAuthorizationError();
    }

    const user = await findActiveStockUser(tx, actor.id);
    if (!user || !user.isActive || user.deletedAt !== null) {
        throw new WorkforceAuthorizationError();
    }

    const currentRole = parseUserRole(user.role);
    const activeEmployee = isActiveStockEmployee(user.employee)
        ? user.employee
        : null;
    if (activeEmployee === null) {
        throw new WorkforceAuthorizationError();
    }

    await lockEmployeeRows(tx, [activeEmployee.id]);
    const activeActor = buildStockAuthorizationActor(
        { id: user.id, role: currentRole },
        activeEmployee.id,
        requestedActor.channel,
    );
    const decision = await authorization.resolveInTransaction(
        activeActor,
        capability,
        tx,
    );
    return composeStockCapabilityAuthorization(
        activeActor,
        capability,
        decision,
    );
}
