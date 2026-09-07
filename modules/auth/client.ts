"use client";

// Browser-safe Auth entry. Keep this export list explicit so the browser
// graph cannot accidentally include the server capability barrel.
export {
    HybridAuthProvider,
    useAuth,
} from "./presentation/HybridAuthProvider";
export type {
    AuthenticatedUser,
    HybridAuthContextValue,
    HybridAuthStatus,
} from "./presentation/HybridAuthProvider";
export {
    AuthStatus,
    ForgotPasswordForm,
    LoginForm,
    RefreshSessionBridge,
    ResetPasswordForm,
    SignupForm,
} from "./presentation";
export {
    fetchWithRefresh,
    logoutHybridSession,
    refreshHybridSession,
    shouldAttemptHybridRefresh,
} from "./presentation/browser-transport";
