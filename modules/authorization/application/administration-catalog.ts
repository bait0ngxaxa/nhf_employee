import {
    CAPABILITY_REGISTRY,
    type RegisteredCapabilityKey,
} from "../registry";
import type { CapabilityDefinition } from "../contracts";
import type {
    CapabilityAdministrationProjection,
} from "./administration-types";

type CapabilityAdministrationMetadata =
    | {
        readonly administrativeStatus: "GRANTABLE";
        readonly administrativelyGrantable: true;
    }
    | {
        readonly administrativeStatus: "DEFERRED";
        readonly administrativelyGrantable: false;
        readonly nonGrantableReason: string;
    };

const GRANTABLE: CapabilityAdministrationMetadata = Object.freeze({
    administrativeStatus: "GRANTABLE",
    administrativelyGrantable: true,
});

const DEFERRED_ROUTINE: CapabilityAdministrationMetadata = Object.freeze({
    administrativeStatus: "DEFERRED",
    administrativelyGrantable: false,
    nonGrantableReason:
        "Deferred Routine runtime path is not consistently backed by central authorization.",
});

const DEFERRED_EMAIL: CapabilityAdministrationMetadata = Object.freeze({
    administrativeStatus: "DEFERRED",
    administrativelyGrantable: false,
    nonGrantableReason:
        "Email Request and the future IT module remain deferred.",
});

/**
 * Administration-only operational metadata. Capability identity, description,
 * scopes, and channels remain exclusively owned by CAPABILITY_REGISTRY.
 *
 * Keep this map exhaustive: a newly registered capability must receive an
 * explicit administration decision before it can be presented as grantable.
 */
const CAPABILITY_ADMINISTRATION_METADATA: Readonly<
    Record<RegisteredCapabilityKey, CapabilityAdministrationMetadata>
> = Object.freeze({
    "employee.read": GRANTABLE,
    "employee.stats.read": GRANTABLE,
    "employee.create": GRANTABLE,
    "employee.update": GRANTABLE,
    "employee.delete": GRANTABLE,
    "employee.import": GRANTABLE,
    "employee.export": GRANTABLE,
    "department.read": GRANTABLE,

    "routine.task.read": GRANTABLE,
    "routine.task.create": GRANTABLE,
    "routine.task.update": GRANTABLE,
    "routine.task.delete": GRANTABLE,
    "routine.occurrence.read": GRANTABLE,
    "routine.occurrence.override": GRANTABLE,
    "routine.occurrence.reassign": GRANTABLE,
    "routine.occurrence.change_due_date": GRANTABLE,
    "routine.import.manage": GRANTABLE,
    "routine.task.export": DEFERRED_ROUTINE,
    "routine.summary.read": DEFERRED_ROUTINE,
    "routine.reference.read": DEFERRED_ROUTINE,

    "stock.catalog.read": GRANTABLE,
    "stock.inventory.manage": GRANTABLE,
    "stock.request.read": GRANTABLE,
    "stock.request.create": GRANTABLE,
    "stock.request.cancel": GRANTABLE,
    "stock.request.process": GRANTABLE,
    "stock.report.export": GRANTABLE,

    "leave.request.read": GRANTABLE,
    "leave.approval.read": GRANTABLE,
    "leave.request.create": GRANTABLE,
    "leave.request.cancel": GRANTABLE,
    "leave.request.approve": GRANTABLE,
    "leave.cancellation.decide": GRANTABLE,
    "leave.request.not_taken": GRANTABLE,
    "leave.approver.manage": GRANTABLE,

    "audit.read": GRANTABLE,

    "email.request.read": DEFERRED_EMAIL,
    "email.request.create": DEFERRED_EMAIL,

    "notification.inbox.read": GRANTABLE,
    "notification.inbox.update": GRANTABLE,
});

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
    const metadata = CAPABILITY_ADMINISTRATION_METADATA[key];
    if (!metadata) {
        throw new Error(
            `Missing authorization administration metadata: ${key}`,
        );
    }

    return Object.freeze({
        key,
        registered: true as const,
        domain: definition.domain,
        description: definition.description,
        supportedScopes: copyArray(definition.scopes),
        supportedChannels: copyArray(definition.channels),
        ...metadata,
    });
}

export function buildCapabilityAdministrationCatalog(): readonly CapabilityAdministrationProjection[] {
    return Object.freeze(
        CAPABILITY_REGISTRY.definitions.map(projectCapabilityAdministration),
    );
}
