import {
    type AuthorizationScope,
    type CapabilityDefinition,
} from "../contracts";
import {
    CAPABILITY_REGISTRY,
    isRegisteredCapabilityKey,
    type RegisteredCapabilityKey,
} from "../registry";

export type CapabilityGrantValidationCode =
    | "UNKNOWN_CAPABILITY"
    | "UNSUPPORTED_SCOPE";

export interface CapabilityGrantInput {
    capabilityKey: string;
    scope: string;
}

export interface ValidatedCapabilityGrant {
    capabilityKey: RegisteredCapabilityKey;
    scope: AuthorizationScope;
}

export class CapabilityGrantValidationError extends Error {
    readonly code: CapabilityGrantValidationCode;

    constructor(code: CapabilityGrantValidationCode, message: string) {
        super(message);
        this.name = "CapabilityGrantValidationError";
        this.code = code;
    }
}

function isSupportedScope(
    definition: CapabilityDefinition,
    scope: string,
): scope is AuthorizationScope {
    return definition.scopes.some((supportedScope) => supportedScope === scope);
}

/**
 * Validate the only registry-backed values that a persisted grant may carry.
 * This function deliberately does not normalize or resolve a grant.
 */
export function validateCapabilityGrant(
    input: CapabilityGrantInput,
): ValidatedCapabilityGrant {
    if (!isRegisteredCapabilityKey(input.capabilityKey)) {
        throw new CapabilityGrantValidationError(
            "UNKNOWN_CAPABILITY",
            `Unknown authorization capability: ${input.capabilityKey}`,
        );
    }

    const definition = CAPABILITY_REGISTRY.get(input.capabilityKey);
    if (!definition) {
        throw new CapabilityGrantValidationError(
            "UNKNOWN_CAPABILITY",
            `Unknown authorization capability: ${input.capabilityKey}`,
        );
    }

    if (!isSupportedScope(definition, input.scope)) {
        throw new CapabilityGrantValidationError(
            "UNSUPPORTED_SCOPE",
            `Unsupported authorization scope for ${input.capabilityKey}: ${input.scope}`,
        );
    }

    return {
        capabilityKey: input.capabilityKey,
        scope: input.scope,
    };
}
