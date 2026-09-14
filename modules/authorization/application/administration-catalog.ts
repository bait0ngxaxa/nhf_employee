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

const ROUTINE_COMPATIBILITY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY" as const,
    nonGrantableReason:
        "The current Routine adapter may translate NO_APPLICABLE_GRANT into a path-specific compatibility scope; ordinary grants require explicit policy activation.",
});

const STOCK_COMPATIBILITY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY" as const,
    nonGrantableReason:
        "The current Stock adapter may translate NO_APPLICABLE_GRANT into a compatibility scope; ordinary grants require explicit policy activation.",
});

const LEAVE_COMPATIBILITY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY" as const,
    nonGrantableReason:
        "The current Leave adapter may translate NO_APPLICABLE_GRANT into a compatibility scope; ordinary grants require explicit policy activation.",
});

const EMPLOYEE_COMPATIBILITY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY" as const,
    nonGrantableReason:
        "The current Employee adapter may translate NO_APPLICABLE_GRANT into a compatibility scope; ordinary grants require explicit policy activation.",
});

const DEPARTMENT_COMPATIBILITY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY" as const,
    nonGrantableReason:
        "The current Department adapter may translate NO_APPLICABLE_GRANT into the legacy reference-data scope; ordinary grants require explicit policy activation.",
});

const NOTIFICATION_COMPATIBILITY: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY" as const,
    nonGrantableReason:
        "The current Notification adapter may translate NO_APPLICABLE_GRANT into the legacy OWN scope; ordinary grants require explicit policy activation.",
});

const DEFERRED_ROUTINE: CapabilityAdministrationMetadata = Object.freeze({
    runtimeAuthorizationMode: "DEFERRED" as const,
    nonGrantableReason:
        "Deferred Routine runtime path is not consistently backed by central authorization.",
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
 * CENTRAL_WITH_COMPATIBILITY is assigned only where the audited domain
 * adapter still translates NO_APPLICABLE_GRANT for a normal production user.
 * An ADMIN-only legacy branch does not qualify: ADMIN is already resolved by
 * the central system-role rule.
 *
 * Keep this map exhaustive: a newly registered capability must receive an
 * explicit administration decision before it can be presented as grantable.
 */
const CAPABILITY_ADMINISTRATION_METADATA: Readonly<
    Record<RegisteredCapabilityKey, CapabilityAdministrationMetadata>
> = Object.freeze({
    "employee.read": EMPLOYEE_COMPATIBILITY,
    "employee.stats.read": EMPLOYEE_COMPATIBILITY,
    "employee.create": CENTRAL_ONLY,
    "employee.update": CENTRAL_ONLY,
    "employee.delete": CENTRAL_ONLY,
    "employee.import": CENTRAL_ONLY,
    "employee.export": EMPLOYEE_COMPATIBILITY,
    "department.read": DEPARTMENT_COMPATIBILITY,

    "routine.task.read": ROUTINE_COMPATIBILITY,
    "routine.task.create": ROUTINE_COMPATIBILITY,
    "routine.task.update": ROUTINE_COMPATIBILITY,
    "routine.task.delete": ROUTINE_COMPATIBILITY,
    "routine.occurrence.read": ROUTINE_COMPATIBILITY,
    "routine.occurrence.override": CENTRAL_ONLY,
    "routine.occurrence.reassign": CENTRAL_ONLY,
    "routine.occurrence.change_due_date": CENTRAL_ONLY,
    "routine.import.manage": CENTRAL_ONLY,
    "routine.task.export": DEFERRED_ROUTINE,
    "routine.summary.read": DEFERRED_ROUTINE,
    "routine.reference.read": DEFERRED_ROUTINE,

    "stock.catalog.read": STOCK_COMPATIBILITY,
    "stock.inventory.manage": CENTRAL_ONLY,
    "stock.request.read": STOCK_COMPATIBILITY,
    "stock.request.create": STOCK_COMPATIBILITY,
    "stock.request.cancel": STOCK_COMPATIBILITY,
    "stock.request.process": CENTRAL_ONLY,
    "stock.report.export": CENTRAL_ONLY,

    "leave.request.read": LEAVE_COMPATIBILITY,
    "leave.approval.read": LEAVE_COMPATIBILITY,
    "leave.request.create": LEAVE_COMPATIBILITY,
    "leave.request.cancel": LEAVE_COMPATIBILITY,
    "leave.request.approve": LEAVE_COMPATIBILITY,
    "leave.cancellation.decide": LEAVE_COMPATIBILITY,
    "leave.request.not_taken": LEAVE_COMPATIBILITY,
    "leave.approver.manage": CENTRAL_ONLY,

    "audit.read": CENTRAL_ONLY,

    "email.request.read": DEFERRED_EMAIL,
    "email.request.create": DEFERRED_EMAIL,

    "notification.inbox.read": NOTIFICATION_COMPATIBILITY,
    "notification.inbox.update": NOTIFICATION_COMPATIBILITY,
});

function getAdministrativeStatus(
    runtimeAuthorizationMode: RuntimeAuthorizationMode,
): CapabilityAdministrationProjection["administrativeStatus"] {
    switch (runtimeAuthorizationMode) {
        case "CENTRAL_ONLY":
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
