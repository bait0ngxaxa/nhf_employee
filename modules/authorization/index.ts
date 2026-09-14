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
export {
    AuthorizationConfigurationError,
    AuthorizationDeniedError,
    AuthorizationAdministrationAccessError,
    AuthorizationAdministrationInputError,
    AuthorizationAdministrationMutationError,
} from "./application/errors";
export type {
    AuthorizationConfigurationErrorCode,
    AuthorizationConfigurationErrorDetails,
    AuthorizationAdministrationMutationErrorCode,
    AuthorizationAdministrationMutationErrorDetails,
} from "./application/errors";
export {
    authorization,
    createAuthorizationResolver,
} from "./application/resolver";
export type {
    AuthorizationResolver,
    AuthorizationResolverDependencies,
} from "./application/resolver";
export type {
    AuthorizationDecision,
    AuthorizationDecisionReason,
    AuthorizationGrantSource,
    AuthorizationMembershipResolution,
    AuthorizationPersistedGrant,
    AuthorizationPersistedTeamGrant,
    AuthorizationPersistedTeamRoleGrant,
    AuthorizationPersistedUserGrant,
    AuthorizationResolutionData,
    AuthorizationResolutionManyRequest,
    AuthorizationResolutionRepository,
    AuthorizationResolutionRequest,
    AuthorizationPersistenceContext,
    EffectiveAuthorizationGrant,
} from "./application/types";
export {
    assertAuthorizationAdministrationAccess,
    getAuthorizationAdministrationCapabilityCatalog,
    getAuthorizationAdministrationOverview,
    getAuthorizationAdministrationTeam,
    getAuthorizationAdministrationUser,
    listAuthorizationAdministrationTeams,
    searchAuthorizationAdministrationUsers,
} from "./application/administration";
export { buildCapabilityAdministrationCatalog } from "./application/administration-catalog";
export type {
    AuthorizationAdministrationAccountIdentity,
    AuthorizationAdministrationConfigurationIssue,
    AuthorizationAdministrationResolverEffectiveGrant,
    AuthorizationAdministrationResolverEffectivePermission,
    AuthorizationAdministrationGrantProjection,
    AuthorizationAdministrationGrantValidation,
    AuthorizationAdministrationGrantValidationCode,
    AuthorizationAdministrationOverview,
    AuthorizationAdministrationPrincipal,
    AuthorizationAdministrationQueryDependencies,
    AuthorizationAdministrationRepository,
    AuthorizationAdministrationResolutionError,
    AuthorizationAdministrationResolverEffectivePermissionStatus,
    AuthorizationAdministrationSourceExplanation,
    AuthorizationAdministrationTeamDetail,
    AuthorizationAdministrationTeamGrant,
    AuthorizationAdministrationTeamMembership,
    AuthorizationAdministrationTeamReference,
    AuthorizationAdministrationTeamRole,
    AuthorizationAdministrationTeamRoleGrant,
    AuthorizationAdministrationTeamRoleReference,
    AuthorizationAdministrationTeamSummary,
    AuthorizationAdministrationUserSummary,
    AuthorizationAdministrationUserDetail,
    AuthorizationAdministrationUserTeamMembership,
    CapabilityAdministrationProjection,
    CapabilityAdministrationStatus,
    RuntimeAuthorizationMode,
} from "./application/administration-types";
export {
    AUTHORIZATION_ADMINISTRATION_USER_SEARCH_LIMIT,
    AUTHORIZATION_ADMINISTRATION_USER_SEARCH_MAX_LENGTH,
} from "./application/administration-types";
export {
    addAuthorizationAdministrationTeamGrant,
    addAuthorizationAdministrationTeamMember,
    addAuthorizationAdministrationTeamRoleGrant,
    addAuthorizationAdministrationUserGrant,
    changeAuthorizationAdministrationTeamMemberRole,
    createAuthorizationAdministrationTeam,
    createAuthorizationAdministrationTeamRole,
    removeAuthorizationAdministrationTeamGrant,
    removeAuthorizationAdministrationTeamMember,
    removeAuthorizationAdministrationTeamRoleGrant,
    removeAuthorizationAdministrationUserGrant,
    updateAuthorizationAdministrationTeam,
    updateAuthorizationAdministrationTeamRole,
} from "./application/administration-mutations";
export type {
    AuthorizationAdministrationMutationDependencies,
} from "./application/administration-mutations";
export {
    addAuthorizationTeamMemberSchema,
    authorizationCapabilityGrantSchema,
    changeAuthorizationTeamMemberRoleSchema,
    createAuthorizationTeamRoleSchema,
    createAuthorizationTeamSchema,
    updateAuthorizationTeamRoleSchema,
    updateAuthorizationTeamSchema,
} from "./application/administration-mutation-schemas";
export type {
    AddAuthorizationTeamMemberInput,
    AuthorizationCapabilityGrantInput,
    ChangeAuthorizationTeamMemberRoleInput,
    CreateAuthorizationTeamInput,
    CreateAuthorizationTeamRoleInput,
    UpdateAuthorizationTeamInput,
    UpdateAuthorizationTeamRoleInput,
} from "./application/administration-mutation-schemas";
export type {
    AuthorizationAdministrationMutationActor,
    AuthorizationAdministrationMutationContext,
    AuthorizationAdministrationMutationMembership,
    AuthorizationAdministrationMutationRepository,
    AuthorizationAdministrationMutationTeam,
    AuthorizationAdministrationMutationTeamGrant,
    AuthorizationAdministrationMutationTeamRole,
    AuthorizationAdministrationMutationTeamRoleGrant,
    AuthorizationAdministrationMutationUser,
    AuthorizationAdministrationMutationUserGrant,
} from "./application/administration-mutation-types";
