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

interface ModuleCardConfig {
    key: keyof LiffHomeResponse["modules"];
    label: string;
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    accentClassName: string;
}

const MODULE_CARDS: readonly ModuleCardConfig[] = [
    {
        key: "stock",
        label: "วัสดุ",
        title: "เบิกวัสดุและติดตามคำขอ",
        description: "จัดการงานวัสดุของคุณในที่เดียว",
        href: APP_ROUTES.line.stock,
        icon: Boxes,
        accentClassName: "text-module-stock-badge-foreground",
    },
    {
        key: "leave",
        label: "วันลา",
        title: "ดูสิทธิ์และจัดการวันลา",
        description: "ตรวจสอบข้อมูลวันลาและคำขอของคุณ",
        href: APP_ROUTES.line.leave,
        icon: CalendarRange,
        accentClassName: "text-module-leave-badge-foreground",
    },
    {
        key: "routine",
        label: "งานประจำ",
        title: "ดูงานประจำของฉัน",
        description: "ติดตามงานประจำและกำหนดส่งที่ได้รับมอบหมาย",
        href: APP_ROUTES.line.routine,
        icon: ClipboardCheck,
        accentClassName: "text-module-routine-badge-foreground",
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
                <Icon
                    className={cn(
                        "mt-1 size-5 shrink-0",
                        module.enabled ? config.accentClassName : "text-content-muted",
                    )}
                    aria-hidden="true"
                />
                <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 className="break-words text-base font-bold leading-6 text-content-heading">
                            {config.title}
                        </h3>
                        <span
                            className={cn(
                                "text-xs font-semibold leading-5",
                                module.enabled
                                    ? config.accentClassName
                                    : "text-content-muted",
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
            <div className="mt-1 shrink-0">
                {module.enabled ? (
                    <ArrowUpRight
                        className={cn("size-5", config.accentClassName)}
                        aria-hidden="true"
                    />
                ) : (
                    <LockKeyhole className="size-5 text-content-muted" aria-hidden="true" />
                )}
            </div>
        </>
    );

    if (!module.enabled) {
        return (
            <div
                aria-disabled="true"
                data-module-enabled="false"
                className="flex min-h-24 w-full items-start justify-between gap-3 border-b border-border-subtle py-4 opacity-70"
            >
                {content}
            </div>
        );
    }

    return (
        <Link
            href={config.href}
            data-module-enabled="true"
            className={cn(
                "group flex min-h-24 w-full items-start justify-between gap-4 border-b border-border-subtle py-4 transition-[color,border-color] hover:border-brand-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40",
                config.key === "routine" && "bg-brand-surface/30 px-3",
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
                    <div className="border-t border-border-subtle">
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
