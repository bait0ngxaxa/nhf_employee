import Link from "next/link";
import type { ReactElement } from "react";

import { AppLogo } from "@/components/brand/AppLogo";
import { APP_ROUTES } from "@/lib/ssot/routes";

interface LiffHeaderProps {
    sectionLabel: string;
}

export function LiffHeader({ sectionLabel }: LiffHeaderProps): ReactElement {
    return (
        <header className="sticky top-0 z-30 border-b border-border-subtle/80 bg-surface/95 pt-[env(safe-area-inset-top)]">
            <div className="flex min-h-12 items-center px-[max(1rem,env(safe-area-inset-left))] py-2 pr-[max(1rem,env(safe-area-inset-right))]">
                <Link
                    href={APP_ROUTES.line.root}
                    aria-label="ไปหน้าหลัก NHFapp"
                    className="flex min-h-11 min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40"
                >
                    <AppLogo variant="navbar" priority className="size-9" />
                    <div className="min-w-0 leading-tight">
                        <p className="truncate text-base font-bold tracking-tight text-content-heading">
                            NHFapp
                        </p>
                        <p className="truncate text-xs font-medium text-content-muted">
                            {sectionLabel}
                        </p>
                    </div>
                </Link>
            </div>
        </header>
    );
}
