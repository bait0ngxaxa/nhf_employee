import {
    CAPABILITY_REGISTRY,
    type RegisteredCapabilityKey,
} from "../registry";
import type { CapabilityDefinition } from "../contracts";
import type {
    CapabilityAdministrationProjection,
    RuntimeAuthorizationMode,
} from "./administration-types";

type CapabilityAdministrationMetadata =
    | {
        readonly runtimeAuthorizationMode: "CENTRAL_ONLY";
    }
    | {
        readonly runtimeAuthorizationMode: "CENTRAL_WITH_DEFAULT_POLICY";
    }
    | {
        readonly runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY";
        readonly nonGrantableReason: string;
    }
    | {
        readonly runtimeAuthorizationMode: "DEFERRED";
        readonly nonGrantableReason: string;
    };

const CENTRAL_ONLY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_ONLY" as const,
});

const CENTRAL_WITH_DEFAULT_POLICY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_DEFAULT_POLICY" as const,
});

const DEFERRED_EMAIL: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "DEFERRED" as const,
    nonGrantableReason:
        "Email Request and the future IT module remain deferred.",
});

/**
 * Administration-only operational metadata. Capability identity, description,
 * scopes, and channels remain exclusively owned by CAPABILITY_REGISTRY.
 *
 * CENTRAL_WITH_DEFAULT_POLICY is assigned where the audited domain adapter
 * composes a permanent normal-user default with central configured authority.
 * CENTRAL_WITH_COMPATIBILITY remains as a historical/future-safe contract for
 * adapters that may translate NO_APPLICABLE_GRANT through temporary migration
 * mechanics; the current registry has no entry using it after Phase 12D. An
 * ADMIN-only legacy branch does not qualify: ADMIN is already resolved by the
 * central system-role rule.
 *
 * Keep this map exhaustive: a newly registered capability must receive an
 * explicit administration decision before it can be presented as grantable.
 */
const CAPABILITY_ADMINISTRATION_METADATA: Readonly<
    Record<RegisteredCapabilityKey, CapabilityAdministrationMetadata>
> = Object.freeze({
    "employee.read": CENTRAL_WITH_DEFAULT_POLICY,
    "employee.stats.read": CENTRAL_WITH_DEFAULT_POLICY,
    "employee.create": CENTRAL_ONLY,
    "employee.update": CENTRAL_ONLY,
    "employee.delete": CENTRAL_ONLY,
    "employee.import": CENTRAL_ONLY,
    "employee.export": CENTRAL_WITH_DEFAULT_POLICY,
    "department.read": CENTRAL_WITH_DEFAULT_POLICY,

    "routine.task.read": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.task.create": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.task.update": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.task.delete": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.occurrence.read": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.occurrence.override": CENTRAL_ONLY,
    "routine.occurrence.reassign": CENTRAL_ONLY,
    "routine.occurrence.change_due_date": CENTRAL_ONLY,
    "routine.import.manage": CENTRAL_ONLY,
    "routine.task.export": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.summary.read": CENTRAL_WITH_DEFAULT_POLICY,
    "routine.reference.read": CENTRAL_WITH_DEFAULT_POLICY,

    "stock.catalog.read": CENTRAL_WITH_DEFAULT_POLICY,
    "stock.inventory.manage": CENTRAL_ONLY,
    "stock.request.read": CENTRAL_WITH_DEFAULT_POLICY,
    "stock.request.create": CENTRAL_WITH_DEFAULT_POLICY,
    "stock.request.cancel": CENTRAL_WITH_DEFAULT_POLICY,
    "stock.request.process": CENTRAL_ONLY,
    "stock.report.export": CENTRAL_ONLY,

    "leave.request.read": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.approval.read": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.request.create": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.request.cancel": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.request.approve": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.cancellation.decide": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.request.not_taken": CENTRAL_WITH_DEFAULT_POLICY,
    "leave.approver.manage": CENTRAL_ONLY,

    "audit.read": CENTRAL_ONLY,

    "email.request.read": DEFERRED_EMAIL,
    "email.request.create": DEFERRED_EMAIL,

    "notification.inbox.read": CENTRAL_WITH_DEFAULT_POLICY,
    "notification.inbox.update": CENTRAL_WITH_DEFAULT_POLICY,
});

function getAdministrativeStatus(
    runtimeAuthorizationMode: RuntimeAuthorizationMode,
): CapabilityAdministrationProjection["administrativeStatus"] {
    switch (runtimeAuthorizationMode) {
        case "CENTRAL_ONLY":
            return "GRANTABLE";
        case "CENTRAL_WITH_DEFAULT_POLICY":
            return "GRANTABLE";
        case "CENTRAL_WITH_COMPATIBILITY":
            return "POLICY_ACTIVATION_REQUIRED";
        case "DEFERRED":
            return "DEFERRED";
    }
}

function copyArray<T>(values: readonly T[]): readonly T[] {
    return Object.freeze([...values]);
}

export function projectCapabilityAdministration(
    definition: CapabilityDefinition,
): CapabilityAdministrationProjection {
    const key = definition.key;
    if (!CAPABILITY_REGISTRY.has(key)) {
        throw new Error(
            `Capability is not present in the code-owned registry: ${key}`,
        );
    }
    const registeredDefinition = CAPABILITY_REGISTRY.get(key);
    if (!registeredDefinition) {
        throw new Error(
            `Capability is not present in the code-owned registry: ${key}`,
        );
    }
    const metadata = CAPABILITY_ADMINISTRATION_METADATA[key];
    if (!metadata) {
        throw new Error(
            `Missing authorization administration metadata: ${key}`,
        );
    }

    const administrativeStatus = getAdministrativeStatus(
        metadata.runtimeAuthorizationMode,
    );

    return Object.freeze({
        key,
        registered: true as const,
        domain: registeredDefinition.domain,
        description: registeredDefinition.description,
        supportedScopes: copyArray(registeredDefinition.scopes),
        supportedChannels: copyArray(registeredDefinition.channels),
        ...metadata,
        runtimeAuthorizationMode: metadata.runtimeAuthorizationMode,
        administrativeStatus,
        administrativelyGrantable: administrativeStatus === "GRANTABLE",
    });
}

export function buildCapabilityAdministrationCatalog(): readonly CapabilityAdministrationProjection[] {
    return Object.freeze(
        CAPABILITY_REGISTRY.definitions.map(projectCapabilityAdministration),
    );
}
