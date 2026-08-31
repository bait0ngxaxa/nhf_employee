"use client";

import liff from "@line/liff";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactElement,
    type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import {
    establishLiffSession,
    LiffApiError,
    linkLiffAccount,
    registerLiffSessionRecovery,
    type LiffWorkforceIdentity,
} from "@/lib/client/liff";
import { isSafeInternalPath } from "@/lib/auth/return-path";
import { getLineLiffId } from "@/lib/line/config";
import { APP_ROUTES, isLiffAppPath } from "@/lib/ssot/routes";

type LiffBootstrapState =
    | "INITIALIZING"
    | "LINE_AUTHENTICATING"
    | "SESSION_ESTABLISHING"
    | "LINK_REQUIRED"
    | "LINKING"
    | "READY"
    | "ERROR";

type LiffErrorAction = "retry" | "login";

interface LiffBootstrapError {
    message: string;
    action: LiffErrorAction;
}

interface LiffBootstrapProps {
    children: ReactNode;
}

const LINE_LOGIN_NOT_COMPLETED = "LINE_LOGIN_NOT_COMPLETED";
const LiffWorkforceContext = createContext<LiffWorkforceIdentity | null>(null);

function removeProviderSearchParams(url: URL): void {
    for (const key of Array.from(url.searchParams.keys())) {
        if (key.startsWith("liff.")) {
            url.searchParams.delete(key);
        }
    }
}

export function buildLiffNhfLoginUrl(currentUrl: URL): string {
    const returnUrl = new URL(currentUrl.toString());
    if (!isLiffAppPath(returnUrl.pathname)) {
        returnUrl.pathname = APP_ROUTES.line.root;
        returnUrl.search = "";
        returnUrl.hash = "";
    }

    removeProviderSearchParams(returnUrl);
    returnUrl.searchParams.delete("lineLogin");
    returnUrl.searchParams.set("link", "1");
    returnUrl.searchParams.set("loginReturn", "1");

    const proposedReturnPath =
        `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
    const returnTo = isSafeInternalPath(proposedReturnPath)
        ? proposedReturnPath
        : `${APP_ROUTES.line.root}?link=1&loginReturn=1`;
    const loginParams = new URLSearchParams({ returnTo });
    return `${APP_ROUTES.login}?${loginParams.toString()}`;
}

function buildLineLoginRedirectUri(currentUrl: URL): string {
    if (!isLiffAppPath(currentUrl.pathname)) {
        throw new Error("Invalid LIFF return path");
    }
    const redirectUrl = new URL(currentUrl.toString());
    removeProviderSearchParams(redirectUrl);
    redirectUrl.searchParams.set("lineLogin", "1");
    return redirectUrl.toString();
}

function clearBootstrapMarkersFromUrl(...markers: string[]): void {
    const url = new URL(window.location.href);
    removeProviderSearchParams(url);
    for (const marker of markers) {
        url.searchParams.delete(marker);
    }
    window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
    );
}

function toBootstrapError(error: unknown): LiffBootstrapError {
    if (error instanceof Error && error.message === LINE_LOGIN_NOT_COMPLETED) {
        return {
            message: "การเข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
            action: "retry",
        };
    }
    if (error instanceof LiffApiError) {
        return { message: error.message, action: "retry" };
    }

    return {
        message: "ไม่สามารถเปิดบริการ NHFapp ผ่าน LINE ได้ กรุณาลองใหม่อีกครั้ง",
        action: "retry",
    };
}

function loadingLabel(state: LiffBootstrapState): string {
    switch (state) {
        case "INITIALIZING":
            return "กำลังเตรียมบริการ NHFapp ผ่าน LINE...";
        case "LINE_AUTHENTICATING":
            return "กำลังยืนยันตัวตนกับ LINE...";
        case "SESSION_ESTABLISHING":
            return "กำลังเตรียมสิทธิ์การเข้าถึง...";
        case "LINKING":
            return "กำลังเชื่อมบัญชีกับ NHFapp...";
        default:
            return "กำลังโหลดข้อมูล...";
    }
}

function LiffLinkRequiredView({ loginUrl }: { loginUrl: string }): ReactElement {
    return (
        <main
            id="main"
            className="flex min-h-svh items-center bg-surface-subtle pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[calc(1.5rem+env(safe-area-inset-top))]"
        >
            <div className="mx-auto w-full max-w-lg">
                <Card className="w-full gap-4 rounded-2xl border-brand-border bg-surface-raised p-5 shadow-sm sm:gap-5 sm:p-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight text-content-heading">
                            เชื่อมบัญชี LINE กับ NHFapp
                        </h1>
                        <p className="text-sm leading-6 text-content-secondary">
                            เชื่อมบัญชี LINE กับบัญชีพนักงาน NHFapp เพียงครั้งเดียว
                            เพื่อใช้บริการของ NHF ผ่าน LINE
                        </p>
                    </div>
                    <Button
                        asChild
                        className="min-h-12 w-full rounded-xl bg-gradient-to-r from-action-gradient-start to-action-gradient-end text-base font-semibold text-content-on-brand hover:from-action-gradient-hover-start hover:to-action-gradient-hover-end"
                    >
                        <a href={loginUrl}>เชื่อมบัญชี NHFapp</a>
                    </Button>
                </Card>
            </div>
        </main>
    );
}

export function LiffBootstrap({ children }: LiffBootstrapProps): ReactElement {
    const [state, setState] = useState<LiffBootstrapState>("INITIALIZING");
    const [viewError, setViewError] = useState<LiffBootstrapError | null>(null);
    const [workforce, setWorkforce] = useState<LiffWorkforceIdentity | null>(null);
    const [loginUrl, setLoginUrl] = useState<string>(APP_ROUTES.login);
    const [retryNonce, setRetryNonce] = useState(0);

    useEffect(() => {
        let active = true;
        const unregister = registerLiffSessionRecovery(
            async (): Promise<boolean> => {
                if (!active || !liff.isLoggedIn()) return false;

                const idToken = liff.getIDToken();
                if (!idToken) return false;

                const session = await establishLiffSession(idToken);
                if (!active || !session.linked) return false;

                setWorkforce(session.workforce);
                return true;
            },
            (): void => {
                if (typeof window !== "undefined") window.location.reload();
            },
        );

        return () => {
            active = false;
            unregister();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async (): Promise<void> => {
            setState("INITIALIZING");
            setViewError(null);
            setWorkforce(null);

            try {
                await liff.init({ liffId: getLineLiffId() });
                if (cancelled) return;

                const currentUrl = new URL(window.location.href);
                const nextLoginUrl = buildLiffNhfLoginUrl(currentUrl);
                setLoginUrl(nextLoginUrl);
                const linkIntent = currentUrl.searchParams.get("link") === "1";
                const returnedFromLogin =
                    currentUrl.searchParams.get("loginReturn") === "1";
                const lineLoginAttempted =
                    currentUrl.searchParams.get("lineLogin") === "1";

                clearBootstrapMarkersFromUrl();

                if (!liff.isLoggedIn()) {
                    if (lineLoginAttempted) {
                        throw new Error(LINE_LOGIN_NOT_COMPLETED);
                    }
                    setState("LINE_AUTHENTICATING");
                    liff.login({
                        redirectUri: buildLineLoginRedirectUri(currentUrl),
                    });
                    return;
                }

                if (lineLoginAttempted) {
                    clearBootstrapMarkersFromUrl("lineLogin");
                }

                const idToken = liff.getIDToken();
                if (!idToken) {
                    throw new Error("LINE ID token is unavailable");
                }

                if (linkIntent) {
                    setState("LINKING");
                    try {
                        const linkedSession = await linkLiffAccount(idToken);
                        if (cancelled) return;
                        setWorkforce(linkedSession.workforce);
                        clearBootstrapMarkersFromUrl("link", "loginReturn");
                    } catch (error) {
                        if (error instanceof LiffApiError && error.status === 401) {
                            if (!returnedFromLogin) {
                                window.location.assign(nextLoginUrl);
                                return;
                            }
                            setViewError({
                                message: "ยังไม่พบการเข้าสู่ระบบ NHFapp กรุณาเข้าสู่ระบบอีกครั้ง",
                                action: "login",
                            });
                            setState("ERROR");
                            return;
                        }
                        throw error;
                    }
                } else {
                    setState("SESSION_ESTABLISHING");
                    const session = await establishLiffSession(idToken);
                    if (cancelled) return;
                    if (!session.linked) {
                        setState("LINK_REQUIRED");
                        return;
                    }
                    setWorkforce(session.workforce);
                }

                setState("READY");
            } catch (error) {
                if (cancelled) return;
                setViewError(toBootstrapError(error));
                setState("ERROR");
            }
        };

        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [retryNonce]);

    const contextValue = useMemo(() => workforce, [workforce]);

    if (state === "LINK_REQUIRED") {
        return <LiffLinkRequiredView loginUrl={loginUrl} />;
    }

    if (state === "ERROR") {
        const onAction = viewError?.action === "login"
            ? () => window.location.assign(loginUrl)
            : () => {
                  clearBootstrapMarkersFromUrl("lineLogin");
                  setRetryNonce((current) => current + 1);
              };
        return (
            <ErrorState
                title="เปิดบริการ NHFapp ผ่าน LINE ไม่สำเร็จ"
                description={viewError?.message ?? "กรุณาลองใหม่อีกครั้ง"}
                action={{
                    label: viewError?.action === "login"
                        ? "เข้าสู่ระบบ NHFapp"
                        : "ลองใหม่",
                    onClick: onAction,
                }}
                className="min-h-svh rounded-none border-0 bg-surface-subtle pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[calc(2.5rem+env(safe-area-inset-top))]"
            />
        );
    }

    if (
        state !== "READY"
        || !contextValue
    ) {
        return (
            <LoadingState
                label={loadingLabel(state)}
                className="min-h-svh rounded-none border-0 bg-surface-subtle pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[calc(2.5rem+env(safe-area-inset-top))]"
            />
        );
    }

    return (
        <LiffWorkforceContext.Provider value={contextValue}>
            {children}
        </LiffWorkforceContext.Provider>
    );
}

export function useLiffWorkforce(): LiffWorkforceIdentity {
    const workforce = useContext(LiffWorkforceContext);
    if (!workforce) {
        throw new Error("useLiffWorkforce must be used within LiffBootstrap");
    }
    return workforce;
}
