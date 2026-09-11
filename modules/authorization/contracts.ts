import type { UserRole } from "@/lib/ssot/permissions";

export const AUTHORIZATION_CHANNELS = Object.freeze([
    "DASHBOARD",
    "LIFF_SELF_SERVICE",
    "SYSTEM",
] as const);

export type AuthorizationChannel = (typeof AUTHORIZATION_CHANNELS)[number];

export const AUTHORIZATION_SCOPES = Object.freeze([
    "OWN",
    "CREATED",
    "ASSIGNED",
    "TEAM",
    "ALL",
] as const);

export type AuthorizationScope = (typeof AUTHORIZATION_SCOPES)[number];

export const AUTHORIZATION_DOMAINS = Object.freeze([
    "employee",
    "department",
    "routine",
    "stock",
    "leave",
    "audit",
    "email",
    "notification",
] as const);

export type AuthorizationDomain = (typeof AUTHORIZATION_DOMAINS)[number];

/**
 * A capability key is a lower-case dot-separated identifier owned by a
 * registered authorization domain. Root-resource operations use the
 * two-segment form used by the architecture examples; nested resources use
 * three segments.
 */
export type CapabilityKey =
    | `${AuthorizationDomain}.${string}`
    | `${AuthorizationDomain}.${string}.${string}`;

/**
 * The generic actor intentionally carries identity, system role, and the
 * authorization execution channel only. Domain relationships stay in their
 * owning capability.
 */
export interface AuthorizationActor {
    userId: number;
    employeeId: number | null;
    systemRole: UserRole;
    channel: AuthorizationChannel;
}

export interface CapabilityDefinition {
    key: CapabilityKey;
    domain: AuthorizationDomain;
    scopes: readonly AuthorizationScope[];
    channels: readonly AuthorizationChannel[];
}

export interface CapabilityRegistry<K extends CapabilityKey = CapabilityKey> {
    readonly definitions: readonly CapabilityDefinition[];
    get(key: string): CapabilityDefinition | undefined;
    has(key: string): key is K;
}
