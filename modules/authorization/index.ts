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
    AuthorizationRecipientCandidate,
    AuthorizationRecipientLookupRequest,
    AuthorizationRecipientRepository,
    EffectiveAuthorizationGrant,
} from "./application/types";
export {
    authorizationRecipientLookup,
    createAuthorizationRecipientLookup,
    findActiveUsersWithConfiguredCapabilityScope,
} from "./application/recipient-lookup";
export type {
    AuthorizationRecipientLookup,
    AuthorizationRecipientLookupDependencies,
} from "./application/recipient-lookup";
export { composeAuthorizationAuthority } from "./application/composition";
export type {
    ComposedAuthorizationAuthority,
} from "./application/composition";
export {
    createDeferredAuthorizationAdministrationInspection,
    createUnsupportedAuthorizationAdministrationInspection,
    projectAuthorizationAdministrationEffectiveAccess,
} from "./application/administration-effective-access";
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
    AuthorizationAdministrationAdditionalAuthority,
    AuthorizationAdministrationDefaultAuthority,
    AuthorizationAdministrationEffectiveAccessInspection,
    AuthorizationAdministrationEffectiveAccessLimitation,
    AuthorizationAdministrationEffectiveAccessProvider,
    AuthorizationAdministrationEffectiveAccessProviderInput,
    AuthorizationAdministrationEffectiveAccessRow,
    AuthorizationAdministrationEffectiveAccessState,
    AuthorizationAdministrationEffectiveAccessStatus,
    AuthorizationAdministrationEffectiveAccessSummary,
    AuthorizationAdministrationEffectiveAuthority,
    AuthorizationAdministrationInspectionContext,
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
    AuthorizationAdministrationUserTeamSummary,
    AuthorizationAdministrationUserDetail,
    AuthorizationAdministrationUserQueryDependencies,
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
    AuthorizationAdministrationMutationActorState,
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
export {
    AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS,
    AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL,
    AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL_NOTICE,
    createAuthorizationProductionReadinessNotRunReport,
    determineAuthorizationProductionReadinessExitCode,
    evaluateAuthorizationProductionReadiness,
    projectAuthorizationProductionReadinessReport,
    runAuthorizationProductionPreflight,
    validateAuthorizationProductionCanaryPlan,
} from "./application/production-readiness";
export type {
    AuthorizationProductionAuthorityModel,
    AuthorizationProductionCanaryEffectiveAccessBefore,
    AuthorizationProductionCanaryIssue,
    AuthorizationProductionCanaryIssueCode,
    AuthorizationProductionCanaryPlan,
    AuthorizationProductionCanaryValidationDependencies,
    AuthorizationProductionCanaryValidation,
    AuthorizationProductionEmployeeSnapshot,
    AuthorizationProductionEmployeeStatus,
    AuthorizationProductionFinding,
    AuthorizationProductionFindingCode,
    AuthorizationProductionFindingCount,
    AuthorizationProductionFindingKind,
    AuthorizationProductionFindingSeverity,
    AuthorizationProductionFindingSource,
    AuthorizationProductionGroupedCount,
    AuthorizationProductionInventorySnapshot,
    AuthorizationProductionInventorySummary,
    AuthorizationProductionMembershipSnapshot,
    AuthorizationProductionMigrationCheck,
    AuthorizationProductionMigrationEvidenceStatus,
    AuthorizationProductionMigrationSnapshot,
    AuthorizationProductionReadinessEvaluation,
    AuthorizationProductionReadinessReport,
    AuthorizationProductionReadinessRepository,
    AuthorizationProductionReadinessStatus,
    AuthorizationProductionSourceScopeCount,
    AuthorizationProductionTeamGrantSnapshot,
    AuthorizationProductionTeamRoleGrantSnapshot,
    AuthorizationProductionTeamRoleSnapshot,
    AuthorizationProductionTeamSnapshot,
    AuthorizationProductionUserGrantSnapshot,
    AuthorizationProductionUserRole,
    AuthorizationProductionUserSnapshot,
    AuthorizationProductionWarningFindingReference,
    AuthorizationProductionWarningReview,
} from "./application/production-readiness";
export {
    createAuthorizationProductionReadinessRepository,
} from "./infrastructure/persistence/authorization-production-readiness-repository";
export { findActiveUserTeams } from "./infrastructure/persistence/user-team-queries";
