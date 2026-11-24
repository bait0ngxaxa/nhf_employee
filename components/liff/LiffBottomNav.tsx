import { House, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { BrandAsset } from "@/components/brand/BrandAsset";
import type { VisualAssetKey } from "@/lib/ui/visual-assets";
import { mobileNavigationItemClassName } from "@/lib/ui/mobile-navigation-styles";
import { APP_ROUTES } from "@/lib/ssot/routes";

interface LiffBottomNavProps {
    pathname: string | null;
}

type LiffNavItem = {
    key: string;
    href: string;
    label: string;
} & ({ asset: VisualAssetKey } | { icon: LucideIcon });

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
        label: "วัสดุ",
        asset: "stock",
    },
    {
        key: "leave",
        href: APP_ROUTES.line.leave,
        label: "วันลา",
        asset: "leave",
    },
    {
        key: "routine",
        href: APP_ROUTES.line.routine,
        label: "งานประจำ",
        asset: "routine",
    },
    {
        key: "it",
        href: APP_ROUTES.line.it,
        label: "IT",
        asset: "it-ticket",
    },
] as const satisfies readonly LiffNavItem[];

function getActiveNavKey(pathname: string | null): string | null {
    if (!pathname) return null;
    if (pathname === APP_ROUTES.line.root) return "home";
    if (pathname.startsWith(`${APP_ROUTES.line.stock}/`)
        || pathname === APP_ROUTES.line.stock) return "stock";
    if (pathname.startsWith(`${APP_ROUTES.line.leave}/`)
        || pathname === APP_ROUTES.line.leave) return "leave";
    if (pathname.startsWith(`${APP_ROUTES.line.routine}/`)
        || pathname === APP_ROUTES.line.routine) return "routine";
    if (pathname.startsWith(`${APP_ROUTES.line.it}/`)
        || pathname === APP_ROUTES.line.it) return "it";
    return null;
}

export function LiffBottomNav({ pathname }: LiffBottomNavProps): ReactElement {
    const activeKey = getActiveNavKey(pathname);

    return (
        <nav
            aria-label="เมนูบริการ NHFapp ผ่าน LINE"
            className="sticky bottom-0 z-30 border-t border-border-subtle/80 bg-surface/98 px-[max(0.5rem,env(safe-area-inset-left))] pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-1.5 pr-[max(0.5rem,env(safe-area-inset-right))]"
        >
            <div className="grid grid-cols-5 gap-1">
                {NAV_ITEMS.map((item) => {
                    const active = item.key === activeKey;
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={mobileNavigationItemClassName(active)}
                        >
                            {active ? (
                                <span
                                    className="absolute inset-x-4 top-0 h-0.5 bg-brand-solid"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {"asset" in item ? (
                                <BrandAsset asset={item.asset} variant="compact" size="sm" />
                            ) : (
                                <span className="grid size-6 shrink-0 place-items-center">
                                    <item.icon className="size-5" aria-hidden="true" />
                                </span>
                            )}
                            <span className="truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
