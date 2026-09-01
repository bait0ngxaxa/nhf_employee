import {
    ArrowRight,
    Boxes,
    CalendarRange,
    ClipboardCheck,
    CircleCheck,
    CircleOff,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/utils";
import { APP_ROUTES } from "@/lib/ssot/routes";

export type LiffLandingModule = "stock" | "leave" | "routine";

interface LiffModuleLandingProps {
    module: LiffLandingModule;
    enabled: boolean;
}

const MODULE_CONFIG: Record<
    LiffLandingModule,
    {
        label: string;
        title: string;
        description: string;
        nextDescription: string;
        icon: LucideIcon;
        accentClassName: string;
        iconClassName: string;
    }
> = {
    stock: {
        label: "Stock",
        title: "เบิกวัสดุและติดตามคำขอ",
        description: "บริการ Stock บน LINE กำลังเตรียมให้ใช้งานในขั้นถัดไป",
        nextDescription: "ระยะนี้คุณยังใช้ Stock ผ่าน NHFapp บนเว็บได้ตามสิทธิ์เดิม",
        icon: Boxes,
        accentClassName: "bg-module-stock-badge-surface text-module-stock-badge-foreground",
        iconClassName: "border-module-stock-badge-border bg-module-stock-badge-surface text-module-stock-solid",
    },
    leave: {
        label: "Leave",
        title: "ดูสิทธิ์และจัดการวันลา",
        description: "บริการ Leave บน LINE กำลังเตรียมให้ใช้งานในขั้นถัดไป",
        nextDescription: "ระยะนี้คุณยังใช้ Leave ผ่าน NHFapp บนเว็บได้ตามสิทธิ์เดิม",
        icon: CalendarRange,
        accentClassName: "bg-module-leave-badge-surface text-module-leave-badge-foreground",
        iconClassName: "border-module-leave-badge-border bg-module-leave-badge-surface text-module-leave-solid",
    },
    routine: {
        label: "Routine",
        title: "งาน Routine ของฉัน",
        description: "บริการ Routine บน LINE กำลังเตรียมให้ใช้งานในขั้นถัดไป",
        nextDescription: "ระยะนี้คุณยังใช้ Routine ผ่าน NHFapp บนเว็บได้ตามสิทธิ์เดิม",
        icon: ClipboardCheck,
        accentClassName: "bg-brand-surface text-brand-strong",
        iconClassName: "border-brand-border bg-brand-surface text-brand-strong",
    },
};

export function LiffModuleLanding({
    module,
    enabled,
}: LiffModuleLandingProps): ReactElement {
    const config = MODULE_CONFIG[module];
    const Icon = config.icon;
    const href = APP_ROUTES.line.root;

    return (
        <main
            id="main"
            className="px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-6 pr-[max(1rem,env(safe-area-inset-right))] sm:pt-8"
        >
            <div className="space-y-6">
                <section className="border-b border-border-subtle pb-5">
                    <div className="flex items-center justify-between gap-3">
                        <div
                            className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                                config.iconClassName,
                            )}
                        >
                            <Icon className="size-5" aria-hidden="true" />
                        </div>
                        <span
                            className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-semibold",
                                enabled
                                    ? config.accentClassName
                                    : "border-border-subtle bg-surface-muted text-content-muted",
                            )}
                        >
                            {enabled ? "เร็ว ๆ นี้" : "ปิดการใช้งาน"}
                        </span>
                    </div>
                    <div className="mt-4 space-y-2">
                        <p className="text-sm font-bold text-brand-strong">
                            {config.label}
                        </p>
                        <h1 className="max-w-[24ch] text-2xl font-bold leading-tight tracking-tight text-content-heading sm:text-3xl">
                            {enabled ? config.title : `${config.label} ยังไม่พร้อมใช้งาน`}
                        </h1>
                        <p className="max-w-[42ch] text-sm leading-6 text-content-secondary">
                            {enabled
                                ? config.description
                                : "บริการนี้ยังไม่เปิดใช้งานสำหรับบัญชีของคุณในขณะนี้"}
                        </p>
                    </div>
                </section>

                <section
                    className="border-t border-border-subtle pt-4"
                    aria-labelledby={`${module}-next-heading`}
                >
                    <div className="flex items-start gap-3">
                        {enabled ? (
                            <CircleCheck
                                className="mt-0.5 size-5 shrink-0 text-status-success-foreground"
                                aria-hidden="true"
                            />
                        ) : (
                            <CircleOff
                                className="mt-0.5 size-5 shrink-0 text-content-muted"
                                aria-hidden="true"
                            />
                        )}
                        <div className="min-w-0">
                            <h2
                                id={`${module}-next-heading`}
                                className="text-sm font-bold text-content-heading"
                            >
                                {enabled ? "กำลังเตรียมพื้นที่บริการ" : "ต้องเปิดใช้งานก่อน"}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-content-secondary">
                                {enabled
                                    ? config.nextDescription
                                    : "กรุณาติดต่อผู้ดูแลระบบหากคิดว่าควรเข้าถึงบริการนี้ได้"}
                            </p>
                        </div>
                    </div>
                </section>

                <Link
                    href={href}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-brand-border bg-surface-raised px-4 py-3 text-sm font-semibold text-brand-strong transition-[background-color,border-color] hover:border-brand-border-strong hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40"
                >
                    <span>กลับไปดูบริการทั้งหมด</span>
                    <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
                </Link>
            </div>
        </main>
    );
}
