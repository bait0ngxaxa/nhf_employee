import type {
    AuthorizationDecision,
    AuthorizationDecisionReason,
} from "./types";

export type AuthorizationConfigurationErrorCode =
    | "UNKNOWN_PERSISTED_CAPABILITY"
    | "UNSUPPORTED_PERSISTED_SCOPE"
    | "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN"
    | "TEAM_GRANT_ORIGIN_MISMATCH"
    | "TEAM_ROLE_GRANT_ORIGIN_MISMATCH"
    | "TEAM_ROLE_MEMBERSHIP_MISMATCH"
    | "UNSUPPORTED_ADMIN_TEAM_SCOPE";

export interface AuthorizationConfigurationErrorDetails {
    readonly capabilityKey?: string;
    readonly scope?: string;
    readonly teamId?: number;
    readonly teamRoleId?: number;
}

export class AuthorizationConfigurationError extends Error {
    readonly code: AuthorizationConfigurationErrorCode;
    readonly details: AuthorizationConfigurationErrorDetails;

    constructor(
        code: AuthorizationConfigurationErrorCode,
        message: string,
        details: AuthorizationConfigurationErrorDetails = {},
    ) {
        super(message);
        this.name = "AuthorizationConfigurationError";
        this.code = code;
        this.details = details;
    }
}

export class AuthorizationDeniedError extends Error {
    readonly decision: AuthorizationDecision;
    readonly capability: string;
    readonly reason: AuthorizationDecisionReason;

    constructor(decision: AuthorizationDecision) {
        super(`Authorization denied for capability: ${decision.capability}`);
        this.name = "AuthorizationDeniedError";
        this.decision = decision;
        this.capability = decision.capability;
        this.reason = decision.reason ?? "NO_APPLICABLE_GRANT";
    }
}

export class AuthorizationAdministrationAccessError extends Error {
    readonly code = "ADMIN_REQUIRED" as const;

    constructor() {
        super("Authorization Administration requires the ADMIN system role");
        this.name = "AuthorizationAdministrationAccessError";
    }
}

export type AuthorizationAdministrationInputErrorCode =
    | "INVALID_IDENTIFIER"
    | "INVALID_INPUT";

export class AuthorizationAdministrationInputError extends Error {
    readonly code: AuthorizationAdministrationInputErrorCode;

    constructor(code: AuthorizationAdministrationInputErrorCode = "INVALID_IDENTIFIER") {
        super("Invalid Authorization Administration identifier");
        this.name = "AuthorizationAdministrationInputError";
        this.code = code;
    }
}

export type AuthorizationAdministrationMutationErrorCode =
    | "INVALID_INPUT"
    | "NOT_FOUND"
    | "CONFLICT"
    | "DUPLICATE_MEMBERSHIP"
    | "DUPLICATE_GRANT"
    | "TEAM_ROLE_TEAM_MISMATCH"
    | "UNKNOWN_CAPABILITY"
    | "UNSUPPORTED_SCOPE"
    | "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN"
    | "CAPABILITY_POLICY_ACTIVATION_REQUIRED"
    | "CAPABILITY_DEFERRED"
    | "INVALID_AUTHORIZATION_CONFIGURATION"
    | "NO_STATE_CHANGE";

export interface AuthorizationAdministrationMutationErrorDetails {
    readonly capabilityKey?: string;
    readonly scope?: string;
    readonly teamId?: number;
    readonly teamRoleId?: number;
    readonly userId?: number;
}

export class AuthorizationAdministrationMutationError extends Error {
    readonly code: AuthorizationAdministrationMutationErrorCode;
    readonly details: AuthorizationAdministrationMutationErrorDetails;

    constructor(
        code: AuthorizationAdministrationMutationErrorCode,
        message: string,
        details: AuthorizationAdministrationMutationErrorDetails = {},
    ) {
        super(message);
        this.name = "AuthorizationAdministrationMutationError";
        this.code = code;
        this.details = details;
    }
}
