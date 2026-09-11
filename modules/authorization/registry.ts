import {
    AUTHORIZATION_CHANNELS,
    AUTHORIZATION_DOMAINS,
    AUTHORIZATION_SCOPES,
    type AuthorizationChannel,
    type AuthorizationDomain,
    type AuthorizationScope,
    type CapabilityDefinition,
    type CapabilityKey,
    type CapabilityRegistry,
} from "./contracts";

function defineCapability<const T extends CapabilityDefinition>(definition: T): T {
    Object.freeze(definition.scopes);
    Object.freeze(definition.channels);
    return Object.freeze(definition);
}

/**
 * The code-owned inventory. Do not add a key for presentation-only controls,
 * authentication boundaries, or a domain relationship that has no stable
 * generic scope yet.
 */
export const CAPABILITY_DEFINITIONS = Object.freeze([
    defineCapability({
        key: "employee.read",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.stats.read",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.create",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.update",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.delete",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.import",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.export",
        domain: "employee",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "department.read",
        domain: "department",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "routine.task.read",
        domain: "routine",
        scopes: ["CREATED", "ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.task.create",
        domain: "routine",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.task.update",
        domain: "routine",
        scopes: ["CREATED", "ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.task.delete",
        domain: "routine",
        scopes: ["CREATED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.read",
        domain: "routine",
        scopes: ["ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.override",
        domain: "routine",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.reassign",
        domain: "routine",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.change_due_date",
        domain: "routine",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.import.manage",
        domain: "routine",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.task.export",
        domain: "routine",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.summary.read",
        domain: "routine",
        scopes: ["ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.reference.read",
        domain: "routine",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),

    defineCapability({
        key: "stock.catalog.read",
        domain: "stock",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.inventory.manage",
        domain: "stock",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "stock.request.read",
        domain: "stock",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.request.create",
        domain: "stock",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.request.cancel",
        domain: "stock",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.request.process",
        domain: "stock",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.report.export",
        domain: "stock",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "leave.request.read",
        domain: "leave",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.approval.read",
        domain: "leave",
        scopes: ["ASSIGNED"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.request.create",
        domain: "leave",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.request.cancel",
        domain: "leave",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.request.approve",
        domain: "leave",
        scopes: ["ASSIGNED"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.cancellation.decide",
        domain: "leave",
        scopes: ["ASSIGNED"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "leave.request.not_taken",
        domain: "leave",
        scopes: ["OWN", "ASSIGNED"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.approver.manage",
        domain: "leave",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "audit.read",
        domain: "audit",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "email.request.read",
        domain: "email",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "email.request.create",
        domain: "email",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "notification.inbox.read",
        domain: "notification",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "notification.inbox.update",
        domain: "notification",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD"] as const,
    }),
] as const satisfies readonly CapabilityDefinition[]);

export type RegisteredCapabilityKey =
    (typeof CAPABILITY_DEFINITIONS)[number]["key"];

export const CAPABILITY_KEYS = Object.freeze(
    CAPABILITY_DEFINITIONS.map((definition) => definition.key),
) as readonly RegisteredCapabilityKey[];

const CAPABILITY_KEY_PATTERN =
    /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*){1,2}$/;

function isAuthorizationDomain(value: unknown): value is AuthorizationDomain {
    return (
        typeof value === "string"
        && AUTHORIZATION_DOMAINS.some((domain) => domain === value)
    );
}

function isAuthorizationScope(value: unknown): value is AuthorizationScope {
    return (
        typeof value === "string"
        && AUTHORIZATION_SCOPES.some((scope) => scope === value)
    );
}

function isAuthorizationChannel(value: unknown): value is AuthorizationChannel {
    return (
        typeof value === "string"
        && AUTHORIZATION_CHANNELS.some((channel) => channel === value)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function isAuthorizationScopeArray(
    value: unknown,
): value is readonly AuthorizationScope[] {
    return (
        isReadonlyArray(value)
        && value.length > 0
        && value.every(isAuthorizationScope)
    );
}

function isAuthorizationChannelArray(
    value: unknown,
): value is readonly AuthorizationChannel[] {
    return (
        isReadonlyArray(value)
        && value.length > 0
        && value.every(isAuthorizationChannel)
    );
}

export function isCapabilityKey(value: string): value is CapabilityKey {
    if (!CAPABILITY_KEY_PATTERN.test(value)) return false;
    const domain = value.split(".")[0];
    return isAuthorizationDomain(domain);
}

function assertUniqueValues(
    values: readonly string[],
    label: string,
    index: number,
): void {
    if (new Set(values).size !== values.length) {
        throw new Error(
            `Invalid capability definition at index ${index}: duplicate ${label}`,
        );
    }
}

function assertValidCapabilityDefinition(
    value: unknown,
    index: number,
): asserts value is CapabilityDefinition {
    if (!isRecord(value)) {
        throw new Error(`Invalid capability definition at index ${index}`);
    }

    const key = value.key;
    if (typeof key !== "string" || !isCapabilityKey(key)) {
        throw new Error(
            `Invalid capability definition at index ${index}: invalid key`,
        );
    }

    const domain = value.domain;
    if (!isAuthorizationDomain(domain) || domain !== key.split(".")[0]) {
        throw new Error(
            `Invalid capability definition at index ${index}: invalid domain`,
        );
    }

    if (!isAuthorizationScopeArray(value.scopes)) {
        throw new Error(
            `Invalid capability definition at index ${index}: invalid scopes`,
        );
    }
    assertUniqueValues(value.scopes, "scopes", index);

    if (!isAuthorizationChannelArray(value.channels)) {
        throw new Error(
            `Invalid capability definition at index ${index}: invalid channels`,
        );
    }
    assertUniqueValues(value.channels, "channels", index);
}

export function createCapabilityRegistry<
    T extends readonly CapabilityDefinition[],
>(definitions: T): CapabilityRegistry<T[number]["key"]> {
    if (definitions.length === 0) {
        throw new Error("A capability registry must contain at least one definition");
    }

    const keys = new Set<string>();
    for (const [index, definition] of definitions.entries()) {
        assertValidCapabilityDefinition(definition, index);
        if (keys.has(definition.key)) {
            throw new Error(
                `Invalid capability registry: duplicate key ${definition.key}`,
            );
        }
        keys.add(definition.key);
    }

    const frozenDefinitions = Object.freeze(
        definitions.map((definition) =>
            Object.freeze({
                key: definition.key,
                domain: definition.domain,
                scopes: Object.freeze([...definition.scopes]),
                channels: Object.freeze([...definition.channels]),
            }),
        ),
    );
    const definitionsByKey = new Map<string, CapabilityDefinition>();
    for (const definition of frozenDefinitions) {
        definitionsByKey.set(definition.key, definition);
    }

    const registry: CapabilityRegistry<T[number]["key"]> = {
        definitions: frozenDefinitions,
        get(key: string): CapabilityDefinition | undefined {
            return definitionsByKey.get(key);
        },
        has(key: string): key is T[number]["key"] {
            return definitionsByKey.has(key);
        },
    };

    return Object.freeze(registry);
}

export const CAPABILITY_REGISTRY = createCapabilityRegistry(
    CAPABILITY_DEFINITIONS,
);

export function isRegisteredCapabilityKey(
    value: string,
): value is RegisteredCapabilityKey {
    return CAPABILITY_REGISTRY.has(value);
}

export function getCapabilityDefinition(
    key: string,
): CapabilityDefinition | undefined {
    return CAPABILITY_REGISTRY.get(key);
}
