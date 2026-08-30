"use client";

import {
    ArrowUpRight,
    Boxes,
    CalendarRange,
    ClipboardCheck,
    LockKeyhole,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
    useCallback,
    useEffect,
    useState,
    type ReactElement,
} from "react";

import { useLiffWorkforce } from "@/components/liff/LiffBootstrap";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { fetchLiffHome } from "@/lib/client/liff-home";
import { LiffApiError } from "@/lib/client/liff";
import type {
    LiffHomeModule,
    LiffHomeResponse,
} from "@/lib/line/liff-types";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { cn } from "@/lib/ui/utils";

type LiffHomeState = "LOADING" | "READY" | "ERROR";

interface ModuleCardConfig {
    key: keyof LiffHomeResponse["modules"];
    label: string;
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    accentClassName: string;
    iconClassName: string;
}

const MODULE_CARDS: readonly ModuleCardConfig[] = [
    {
        key: "stock",
        label: "Stock",
        title: "เบิกวัสดุและติดตามคำขอ",
        description: "จัดการงานวัสดุของคุณในที่เดียว",
        href: APP_ROUTES.line.stock,
        icon: Boxes,
        accentClassName: "text-module-stock-badge-foreground",
        iconClassName: "border-module-stock-badge-border bg-module-stock-badge-surface text-module-stock-solid",
    },
    {
        key: "leave",
        label: "Leave",
        title: "ดูสิทธิ์และจัดการวันลา",
        description: "ตรวจสอบข้อมูลวันลาและคำขอของคุณ",
        href: APP_ROUTES.line.leave,
        icon: CalendarRange,
        accentClassName: "text-module-leave-badge-foreground",
        iconClassName: "border-module-leave-badge-border bg-module-leave-badge-surface text-module-leave-solid",
    },
    {
        key: "routine",
        label: "Routine",
        title: "ดูงาน Routine ของฉัน",
        description: "ติดตามงานประจำและกำหนดส่งที่ได้รับมอบหมาย",
        href: APP_ROUTES.line.routine,
        icon: ClipboardCheck,
        accentClassName: "text-module-routine-badge-foreground",
        iconClassName: "border-module-routine-badge-border bg-module-routine-badge-surface text-module-routine-solid",
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

function getModuleStatusLabel(module: LiffHomeModule): string {
    switch (module.status) {
        case "available":
            return "เปิดใช้งาน";
        case "coming-soon":
            return "เร็ว ๆ นี้";
        default:
            return "ไม่พร้อมใช้งาน";
    }
}

interface ModuleCardProps {
    config: ModuleCardConfig;
    module: LiffHomeModule;
}

function ModuleCard({ config, module }: ModuleCardProps): ReactElement {
    const Icon = config.icon;
    const statusLabel = getModuleStatusLabel(module);
    const content = (
        <>
            <div className="flex min-w-0 items-start gap-3">
                <div
                    className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
                        config.iconClassName,
                    )}
                >
                    <Icon className="size-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-bold leading-6 text-content-heading">
                            {config.title}
                        </h3>
                        <span
                            className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px] font-bold leading-5",
                                module.enabled
                                    ? `border-transparent bg-surface-subtle ${config.accentClassName}`
                                    : "border-border-subtle bg-surface-muted text-content-muted",
                            )}
                        >
                            {statusLabel}
                        </span>
                    </div>
                    <p className="mt-1 break-words text-sm leading-6 text-content-secondary">
                        {module.enabled
                            ? config.description
                            : "บริการนี้ยังไม่เปิดใช้งานสำหรับบัญชีของคุณ"}
                    </p>
                </div>
            </div>
            <ArrowUpRight
                className={cn(
                    "mt-1 size-5 shrink-0",
                    module.enabled ? config.accentClassName : "text-content-muted",
                )}
                aria-hidden="true"
            />
        </>
    );

    if (!module.enabled) {
        return (
            <div
                aria-disabled="true"
                data-module-enabled="false"
                className="flex min-h-28 w-full items-start justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-muted/70 p-4 opacity-75"
            >
                <LockKeyhole
                    className="mt-1 size-5 shrink-0 text-content-muted"
                    aria-hidden="true"
                />
                <div className="min-w-0 flex-1">{content}</div>
            </div>
        );
    }

    return (
        <Link
            href={config.href}
            data-module-enabled="true"
            className={cn(
                "group flex min-h-28 w-full items-start justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-border-strong hover:bg-brand-surface hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40",
                config.key === "routine" && "min-h-32 border-brand-border bg-brand-surface/60",
            )}
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

    const loadHome = useCallback(async (): Promise<void> => {
        setState("LOADING");
        setViewError(null);

        try {
            const response = await fetchLiffHome();
            setHome(response);
            setState("READY");
        } catch (error) {
            setViewError(getHomeErrorMessage(error));
            setState("ERROR");
        }
    }, []);

    useEffect(() => {
        void loadHome();
    }, [loadHome]);

    if (state === "ERROR") {
        return (
            <ErrorState
                title="โหลดบริการของฉันไม่สำเร็จ"
                description={viewError ?? "กรุณาลองใหม่อีกครั้ง"}
                action={{ label: "ลองใหม่", onClick: () => void loadHome() }}
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    if (state !== "READY" || !home) {
        return (
            <LoadingState
                label="กำลังโหลดบริการของคุณ..."
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
            <div className="space-y-7">
                <section className="relative overflow-hidden rounded-3xl border border-dashboard-hero-border bg-dashboard-hero-surface p-5 text-content-on-brand shadow-lg shadow-dashboard-hero-shadow/15 sm:p-7">
                    <div className="pointer-events-none absolute -bottom-14 -right-10 size-44 rounded-full bg-dashboard-hero-dot/20" />
                    <div className="relative space-y-3">
                        <h1 className="break-words text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                            สวัสดี {displayName}
                        </h1>
                        <p className="max-w-[34ch] text-sm font-medium leading-6 text-dashboard-hero-muted">
                            เลือกบริการที่ต้องการ แล้วทำงานต่อได้ทันทีใน NHFapp
                        </p>
                    </div>
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
                    <div className="space-y-3">
                        {MODULE_CARDS.map((config) => (
                            <ModuleCard
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
