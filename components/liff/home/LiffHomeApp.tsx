"use client";

import {
    Boxes,
    CalendarRange,
    ClipboardCheck,
    Headset,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from "react";

import { LiffApiError, useLiffWorkforce } from "@/modules/line/client";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { fetchLiffHome } from "@/modules/line/client";
import type {
    LiffHomeModule,
    LiffHomeResponse,
} from "@/modules/line/client";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { cn } from "@/lib/ui/utils";

type LiffHomeState = "LOADING" | "READY" | "ERROR";

interface ModuleShortcutConfig {
    key: keyof LiffHomeResponse["modules"];
    label: string;
    href: string;
    icon: LucideIcon;
    surfaceClassName: string;
}

const MODULE_SHORTCUTS: readonly ModuleShortcutConfig[] = [
    {
        key: "stock",
        label: "เบิกวัสดุ",
        href: APP_ROUTES.line.stock,
        icon: Boxes,
        surfaceClassName: "bg-module-stock-dashboard-surface",
    },
    {
        key: "leave",
        label: "วันลา",
        href: APP_ROUTES.line.leave,
        icon: CalendarRange,
        surfaceClassName: "bg-module-leave-dashboard-surface",
    },
    {
        key: "routine",
        label: "งานประจำ",
        href: APP_ROUTES.line.routine,
        icon: ClipboardCheck,
        surfaceClassName: "bg-module-routine-dashboard-surface",
    },
    {
        key: "it",
        label: "บริการ IT",
        href: APP_ROUTES.line.it,
        icon: Headset,
        surfaceClassName: "bg-module-it-dashboard-surface",
    },
];

function getDisplayName(name: string | null): string {
    const trimmedName = name?.trim();
    return trimmedName && trimmedName.length > 0 ? trimmedName : "พนักงาน";
}

function getHomeErrorMessage(error: unknown): string {
    if (error instanceof LiffApiError) return error.message;
    return "ไม่สามารถโหลดบริการของคุณได้ กรุณาลองใหม่อีกครั้ง";
}

function getUnavailableModuleStatusLabel(module: LiffHomeModule): string {
    return module.status === "coming-soon" ? "เร็ว ๆ นี้" : "ยังไม่พร้อม";
}

interface ModuleShortcutProps {
    config: ModuleShortcutConfig;
    module: LiffHomeModule;
}

function ModuleShortcut({ config, module }: ModuleShortcutProps): ReactElement {
    const Icon = config.icon;
    const className = cn(
        "group flex min-h-28 min-w-0 w-full flex-col items-center gap-2 bg-transparent px-0.5 pt-1 pb-2 text-center text-content-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-focus focus-visible:ring-offset-2",
    );
    const content = (
        <>
            <span
                data-shortcut-icon
                className={cn(
                    "flex size-16 shrink-0 items-center justify-center rounded-2xl transition-transform duration-150 group-active:translate-y-px motion-reduce:transform-none",
                    module.enabled
                        ? [config.surfaceClassName, "text-content-on-brand"]
                        : "bg-surface-raised text-content-muted",
                )}
                aria-hidden="true"
            >
                <Icon className="size-7" aria-hidden="true" />
            </span>
            <span
                data-shortcut-label
                className="line-clamp-2 h-10 w-full max-w-full [overflow-wrap:anywhere] text-xs font-semibold leading-5"
            >
                {config.label}
            </span>
            {!module.enabled ? (
                <span
                    data-shortcut-status
                    className="text-xs leading-5 text-content-secondary"
                >
                    {getUnavailableModuleStatusLabel(module)}
                </span>
            ) : null}
        </>
    );

    if (!module.enabled) {
        return (
            <div
                aria-disabled="true"
                data-shortcut-id={config.key}
                data-module-enabled="false"
                className={cn(className, "text-content-muted")}
            >
                {content}
            </div>
        );
    }

    return (
        <Link
            href={config.href}
            data-shortcut-id={config.key}
            data-module-enabled="true"
            className={cn(className, "rounded-2xl")}
        >
            {content}
        </Link>
    );
}

export function LiffHomeApp(): ReactElement {
    const bootstrapWorkforce = useLiffWorkforce();
    const [state, setState] = useState<LiffHomeState>("LOADING");
    const [home, setHome] = useState<LiffHomeResponse | null>(null);
    const [viewError, setViewError] = useState<string | null>(null);
    const requestSequenceRef = useRef(0);

    const runHomeRequest = useCallback(async (requestId: number): Promise<void> => {
        try {
            const response = await fetchLiffHome();
            if (requestSequenceRef.current !== requestId) return;

            setHome(response);
            setViewError(null);
            setState("READY");
        } catch (error) {
            if (requestSequenceRef.current !== requestId) return;

            setViewError(getHomeErrorMessage(error));
            setState("ERROR");
        }
    }, []);

    useEffect(() => {
        const requestId = ++requestSequenceRef.current;
        void runHomeRequest(requestId);

        return () => {
            requestSequenceRef.current += 1;
        };
    }, [runHomeRequest]);

    const retryHome = useCallback((): void => {
        const requestId = ++requestSequenceRef.current;
        setState("LOADING");
        setHome(null);
        setViewError(null);
        void runHomeRequest(requestId);
    }, [runHomeRequest]);

    if (state === "ERROR") {
        return (
            <ErrorState
                title="โหลดบริการของฉันไม่สำเร็จ"
                description={viewError ?? "กรุณาลองใหม่อีกครั้ง"}
                action={{ label: "ลองใหม่", onClick: retryHome }}
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    if (state !== "READY" || !home) {
        return (
            <LoadingState
                label="กำลังโหลดบริการของคุณ…"
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    const displayName = getDisplayName(
        home.workforce.name ?? bootstrapWorkforce.name,
    );

    return (
        <main
            id="main"
            className="px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-6 pr-[max(1rem,env(safe-area-inset-right))] sm:pt-8"
        >
            <div className="space-y-6">
                <section className="border-b border-brand-border pb-5">
                    <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-content-heading sm:text-3xl">
                        สวัสดี {displayName}
                    </h1>
                    <p className="mt-2 max-w-[42ch] text-sm font-medium leading-6 text-content-secondary">
                        เลือกบริการที่ต้องการ แล้วทำงานต่อได้ทันทีใน NHFapp
                    </p>
                </section>

                <section aria-labelledby="liff-home-services-heading">
                    <div className="mb-3 flex items-end justify-between gap-3">
                        <div>
                            <h2
                                id="liff-home-services-heading"
                                className="text-xl font-bold tracking-tight text-content-heading"
                            >
                                บริการของฉัน
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-content-secondary">
                                บริการที่เชื่อมกับบัญชีพนักงานของคุณ
                            </p>
                        </div>
                    </div>
                    <div data-shortcut-grid className="grid grid-cols-4 gap-2">
                        {MODULE_SHORTCUTS.map((config) => (
                            <ModuleShortcut
                                key={config.key}
                                config={config}
                                module={home.modules[config.key]}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
