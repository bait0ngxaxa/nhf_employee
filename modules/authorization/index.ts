export type {
    AuthorizationActor,
    AuthorizationChannel,
    AuthorizationDomain,
    AuthorizationScope,
    CapabilityDefinition,
    CapabilityKey,
    CapabilityRegistry,
} from "./contracts";
export {
    AUTHORIZATION_CHANNELS,
    AUTHORIZATION_DOMAINS,
    AUTHORIZATION_SCOPES,
} from "./contracts";
export {
    CAPABILITY_DEFINITIONS,
    CAPABILITY_KEYS,
    CAPABILITY_REGISTRY,
    createCapabilityRegistry,
    getCapabilityDefinition,
    isCapabilityKey,
    isRegisteredCapabilityKey,
} from "./registry";
export type { RegisteredCapabilityKey } from "./registry";
export {
    CapabilityGrantValidationError,
    validateCapabilityGrant,
} from "./application/grant-validation";
export type {
    CapabilityGrantInput,
    CapabilityGrantValidationCode,
    ValidatedCapabilityGrant,
} from "./application/grant-validation";
export { seedAuthorizationConfiguration } from "./application/seed";
