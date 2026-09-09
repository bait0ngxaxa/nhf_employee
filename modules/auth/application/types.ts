export interface AuthClientMetadata {
    ipAddress?: string;
    userAgent?: string;
}

export interface AuthenticatedPrincipal {
    userId: number;
    role: string;
    sessionFamilyId: string;
    tokenVersion: number;
}

export interface AuthenticatedAccount extends AuthenticatedPrincipal {
    email: string;
    name: string;
}

export interface HybridLoginSuccess {
    status: "success";
    user: {
        id: number;
        email: string;
        name: string;
        role: string;
    };
    accessToken: string;
    rawRefreshToken: string;
}

export interface HybridLoginFailure {
    status: "invalidCredentials";
    userId?: number;
}

export type HybridLoginResult = HybridLoginSuccess | HybridLoginFailure;

export type RefreshSecurityReason =
    | "refresh_token_reuse_or_expired"
    | "inactive_user_refresh_attempt";

export interface RefreshSecurityEvent {
    userId: number;
    email: string;
    familyId: string;
    reason: RefreshSecurityReason;
    ipAddress?: string;
    userAgent?: string;
}

export interface RefreshSuccess {
    status: "success";
    accessToken: string;
    rawRefreshToken: string;
}

export interface RefreshUnauthorized {
    status: "unauthorized";
    securityEvent?: RefreshSecurityEvent;
    preserveCookies?: boolean;
}

export type RefreshResult = RefreshSuccess | RefreshUnauthorized;

export interface AuthSessionItem {
    id: string;
    familyId: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
    isCurrent: boolean;
}

export interface PasswordResetRequestResult {
    rateLimited: boolean;
    rawToken?: string;
    user?: {
        email: string;
        name: string;
    };
}

export type ResetPasswordResult =
    | { status: "invalid" }
    | { status: "used" }
    | { status: "expired" }
    | { status: "userNotFound" }
    | { status: "success"; userId: number; email: string };

export interface SignupResult {
    user: {
        id: number;
        name: string;
        email: string;
        role: string;
    };
    assignedRole: "USER" | "ADMIN";
    employeeDisplayName: string;
}
