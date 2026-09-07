"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";

import { isValidSessionUser } from "@/lib/auth/ssot";
import { API_ROUTES, APP_ROUTES, isLiffAppPath } from "@/lib/ssot/routes";
import { authApiGet } from "./browser-api";
import { logoutHybridSession, refreshHybridSession } from "./browser-transport";
import type { AuthenticatedUser } from "./types";

export type { AuthenticatedUser } from "./types";

export type HybridAuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthMeResponse {
    user: AuthenticatedUser | null;
}

export interface HybridAuthContextValue {
    user: AuthenticatedUser | null;
    status: HybridAuthStatus;
    refreshUser: () => Promise<void>;
    signOut: () => Promise<void>;
}

interface HybridAuthProviderProps {
    children: ReactNode;
}

const HybridAuthContext = createContext<HybridAuthContextValue | null>(null);
const HYBRID_REFRESH_INTERVAL_MS = 12 * 60 * 1000;
const HYBRID_VISIBILITY_REFRESH_MIN_AGE_MS = 10 * 60 * 1000;
const PUBLIC_AUTH_PATHS: ReadonlySet<string> = new Set<string>([
    APP_ROUTES.home,
    APP_ROUTES.login,
    APP_ROUTES.signup,
    APP_ROUTES.refreshSession,
    APP_ROUTES.accessDenied,
    APP_ROUTES.forgotPassword,
    APP_ROUTES.resetPassword,
]);

function shouldBootstrapAuth(pathname: string | null): boolean {
    return !pathname
        || (!PUBLIC_AUTH_PATHS.has(pathname) && !isLiffAppPath(pathname));
}

async function fetchCurrentUser(
    refreshOnUnauthorized: boolean,
): Promise<AuthenticatedUser | null> {
    const result = await authApiGet<AuthMeResponse>(API_ROUTES.auth.me, {
        skipAuthRefresh: !refreshOnUnauthorized,
    });
    if (!result.success || !isValidSessionUser(result.data.user)) {
        return null;
    }
    return result.data.user;
}

export function HybridAuthProvider({ children }: HybridAuthProviderProps) {
    const pathname = usePathname();
    const shouldLoadCurrentUser = shouldBootstrapAuth(pathname);
    const lastRefreshAtRef = useRef(Date.now());
    const { data, isLoading, mutate } = useSWR<AuthenticatedUser | null>(
        shouldLoadCurrentUser ? API_ROUTES.auth.me : null,
        () => fetchCurrentUser(true),
        {
            revalidateOnFocus: true,
            shouldRetryOnError: false,
        },
    );

    const refreshUser = useCallback(async (): Promise<void> => {
        const user = await fetchCurrentUser(true);
        await mutate(user, { revalidate: false });
    }, [mutate]);

    const signOut = useCallback(async (): Promise<void> => {
        await logoutHybridSession();
        await mutate(null, { revalidate: false });
        window.location.assign(APP_ROUTES.login);
    }, [mutate]);

    useEffect(() => {
        if (!data) {
            return;
        }

        const refreshSession = (): void => {
            void (async () => {
                const refreshed = await refreshHybridSession();
                if (refreshed) {
                    lastRefreshAtRef.current = Date.now();
                    await mutate();
                }
            })();
        };

        const intervalId = window.setInterval(
            refreshSession,
            HYBRID_REFRESH_INTERVAL_MS,
        );
        const onVisibilityChange = (): void => {
            const refreshAgeMs = Date.now() - lastRefreshAtRef.current;
            if (
                document.visibilityState === "visible" &&
                refreshAgeMs >= HYBRID_VISIBILITY_REFRESH_MIN_AGE_MS
            ) {
                refreshSession();
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [data, mutate]);

    const status: HybridAuthStatus = isLoading
        ? "loading"
        : data
          ? "authenticated"
          : "unauthenticated";

    const value = useMemo<HybridAuthContextValue>(
        () => ({
            user: data ?? null,
            status,
            refreshUser,
            signOut,
        }),
        [data, refreshUser, signOut, status],
    );

    return (
        <HybridAuthContext.Provider value={value}>
            {children}
        </HybridAuthContext.Provider>
    );
}

export function useAuth(): HybridAuthContextValue {
    const context = useContext(HybridAuthContext);
    if (!context) {
        throw new Error("useAuth must be used within HybridAuthProvider");
    }
    return context;
}
