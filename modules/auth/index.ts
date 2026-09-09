// Auth / Session / Account Identity server capability.
//
// This is the only supported production server entry for the J1 capability.
// HTTP adapters may use this entry to compose request parsing, responses,
// cookies, and deferred Audit producers around the application results.
export {
    authenticateHybridLogin,
} from "./application/authentication";
export {
    refreshHybridSession,
    resolveAuthenticatedAccount,
    resolveAuthenticatedPrincipal,
    resolveAuthenticatedUserId,
    resolveCurrentSessionFamilyId,
    hasActiveAuthSessionFamily,
    logoutCurrentRefreshSession,
    logoutAllRefreshSessions,
    listAuthSessions,
    revokeAuthSessionFamily,
    cleanupAuthRefreshSessions,
} from "./application/sessions";
export { findAccountIdentityById } from "./application/account-identity";
export {
    requestPasswordReset,
    resetPassword,
} from "./application/recovery";
export {
    signupAccount,
    SignupEligibilityError,
} from "./application/signup";
export {
    employeeAccountLifecycle,
    EmployeeAccountLifecycleError,
} from "./application/employee-account-lifecycle";
export {
    AUDIT_FAMILY_CORRELATION_LENGTH,
    getAuditFamilyCorrelation,
} from "./application/audit-correlation";
export {
    AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS,
} from "./infrastructure/persistence/refresh-token-repository";
export type {
    AuthClientMetadata,
    AuthenticatedAccount,
    AuthenticatedPrincipal,
    AuthSessionItem,
    HybridLoginFailure,
    HybridLoginResult,
    HybridLoginSuccess,
    PasswordResetRequestResult,
    RefreshResult,
    RefreshSecurityEvent,
    RefreshSecurityReason,
    RefreshSuccess,
    RefreshUnauthorized,
    ResetPasswordResult,
    SignupResult,
} from "./application/types";
export type { AuthAccountIdentity } from "./infrastructure/persistence/account-repository";

// These token primitives remain a compatibility seam for middleware and the
// existing hybrid-token tests. They contain no persistence and are not a
// browser entry; all authoritative route use cases call the application above.
export {
    buildRefreshTokenRecord,
    generateOpaqueRefreshToken,
    getAccessTokenTtlSeconds,
    getRefreshTokenTtlSeconds,
    hashRefreshToken,
    issueAccessToken,
    verifyAccessToken,
} from "@/lib/auth/hybrid/tokens";
export type {
    AccessTokenClaims,
    IssueAccessTokenInput,
    RefreshTokenRecordDraft,
    RefreshTokenRecordInput,
} from "@/lib/auth/hybrid/tokens";
