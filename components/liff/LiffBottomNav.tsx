import {
    Boxes,
    CalendarRange,
    ClipboardCheck,
    House,
} from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/utils";
import { APP_ROUTES } from "@/lib/ssot/routes";

interface LiffBottomNavProps {
    pathname: string | null;
}

const NAV_ITEMS = [
    {
        key: "home",
        href: APP_ROUTES.line.root,
        label: "หน้าหลัก",
        icon: House,
    },
    {
        key: "stock",
        href: APP_ROUTES.line.stock,
        label: "Stock",
        icon: Boxes,
    },
    {
        key: "leave",
        href: APP_ROUTES.line.leave,
        label: "Leave",
        icon: CalendarRange,
    },
    {
        key: "routine",
        href: APP_ROUTES.line.routine,
        label: "Routine",
        icon: ClipboardCheck,
    },
] as const;

function getActiveNavKey(pathname: string | null): string | null {
    if (!pathname) return null;
    if (pathname === APP_ROUTES.line.root) return "home";
    if (pathname.startsWith(`${APP_ROUTES.line.stock}/`)
        || pathname === APP_ROUTES.line.stock) return "stock";
    if (pathname.startsWith(`${APP_ROUTES.line.leave}/`)
        || pathname === APP_ROUTES.line.leave) return "leave";
    if (pathname.startsWith(`${APP_ROUTES.line.routine}/`)
        || pathname === APP_ROUTES.line.routine) return "routine";
    return null;
}

export function LiffBottomNav({ pathname }: LiffBottomNavProps): ReactElement {
    const activeKey = getActiveNavKey(pathname);

    return (
        <nav
            aria-label="เมนูบริการ NHFapp ผ่าน LINE"
            className="sticky bottom-0 z-30 border-t border-border-subtle/80 bg-surface px-[max(0.5rem,env(safe-area-inset-left))] pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 pr-[max(0.5rem,env(safe-area-inset-right))]"
        >
            <div className="grid grid-cols-4 gap-1">
                {NAV_ITEMS.map((item) => {
                    const active = item.key === activeKey;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold leading-4 transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40",
                                active
                                    ? "bg-brand-surface text-brand-strong shadow-sm"
                                    : "text-content-muted hover:bg-surface-subtle hover:text-content-body",
                            )}
                        >
                            <Icon className="size-5" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
