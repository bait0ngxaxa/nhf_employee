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
        description: "Read Employee records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.stats.read",
        domain: "employee",
        description: "Read aggregate Employee statistics within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.create",
        domain: "employee",
        description: "Create Employee records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.update",
        domain: "employee",
        description: "Update Employee records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.delete",
        domain: "employee",
        description: "Delete Employee records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.import",
        domain: "employee",
        description: "Import Employee records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "employee.export",
        domain: "employee",
        description: "Export Employee records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "department.read",
        domain: "department",
        description: "Read Department reference data within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "routine.task.read",
        domain: "routine",
        description: "Read Routine tasks within an authorized resource scope.",
        scopes: ["CREATED", "ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.task.create",
        domain: "routine",
        description: "Create Routine tasks within an authorized resource scope.",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.task.update",
        domain: "routine",
        description: "Update Routine tasks within an authorized resource scope.",
        scopes: ["CREATED", "ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.task.delete",
        domain: "routine",
        description: "Delete Routine tasks within an authorized resource scope.",
        scopes: ["CREATED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.read",
        domain: "routine",
        description: "Read Routine task occurrences within an authorized resource scope.",
        scopes: ["ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.override",
        domain: "routine",
        description: "Override Routine task occurrence details within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.reassign",
        domain: "routine",
        description: "Reassign Routine task occurrences within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.occurrence.change_due_date",
        domain: "routine",
        description: "Change due dates for Routine task occurrences within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.import.manage",
        domain: "routine",
        description: "Manage Routine task imports within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.task.export",
        domain: "routine",
        description: "Export Routine task records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "routine.summary.read",
        domain: "routine",
        description: "Read Routine task summaries within an authorized resource scope.",
        scopes: ["ASSIGNED", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "routine.reference.read",
        domain: "routine",
        description: "Read Routine task reference data within an authorized resource scope.",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),

    defineCapability({
        key: "stock.catalog.read",
        domain: "stock",
        description: "Read Stock catalog data within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.inventory.manage",
        domain: "stock",
        description: "Manage Stock inventory data within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "stock.request.read",
        domain: "stock",
        description: "Read Stock requests within an authorized resource scope.",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.request.create",
        domain: "stock",
        description: "Create Stock requests within an authorized resource scope.",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.request.cancel",
        domain: "stock",
        description: "Cancel Stock requests within an authorized resource scope.",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.request.process",
        domain: "stock",
        description: "Process Stock requests within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "stock.report.export",
        domain: "stock",
        description: "Export Stock reports within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "leave.request.read",
        domain: "leave",
        description: "Read Leave requests within an authorized resource scope.",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.approval.read",
        domain: "leave",
        description: "Read Leave approval work within an authorized resource scope.",
        scopes: ["ASSIGNED"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.request.create",
        domain: "leave",
        description: "Create Leave requests within an authorized resource scope.",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.request.cancel",
        domain: "leave",
        description: "Cancel Leave requests within an authorized resource scope.",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.request.approve",
        domain: "leave",
        description: "Approve Leave requests within an authorized resource scope.",
        scopes: ["ASSIGNED"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.cancellation.decide",
        domain: "leave",
        description: "Decide Leave request cancellations within an authorized resource scope.",
        scopes: ["ASSIGNED"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "leave.request.not_taken",
        domain: "leave",
        description: "Record a Leave request as not taken within an authorized resource scope.",
        scopes: ["OWN", "ASSIGNED"] as const,
        channels: ["DASHBOARD", "LIFF_SELF_SERVICE"] as const,
    }),
    defineCapability({
        key: "leave.approver.manage",
        domain: "leave",
        description: "Manage Leave approver assignments within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "audit.read",
        domain: "audit",
        description: "Read Audit records within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "email.request.read",
        domain: "email",
        description: "Read Email requests within an authorized resource scope.",
        scopes: ["OWN", "ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "email.request.create",
        domain: "email",
        description: "Create Email requests within an authorized resource scope.",
        scopes: ["ALL"] as const,
        channels: ["DASHBOARD"] as const,
    }),

    defineCapability({
        key: "notification.inbox.read",
        domain: "notification",
        description: "Read Notification inbox entries within an authorized resource scope.",
        scopes: ["OWN"] as const,
        channels: ["DASHBOARD"] as const,
    }),
    defineCapability({
        key: "notification.inbox.update",
        domain: "notification",
        description: "Update Notification inbox entries within an authorized resource scope.",
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

    const description = value.description;
    if (
        typeof description !== "string"
        || description.trim().length === 0
        || description !== description.trim()
    ) {
        throw new Error(
            `Invalid capability definition at index ${index}: invalid description`,
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
                description: definition.description,
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
