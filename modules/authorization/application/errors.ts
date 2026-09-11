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
