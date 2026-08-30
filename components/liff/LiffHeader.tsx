import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import { APP_ROUTES } from "@/lib/ssot/routes";

interface LiffHeaderProps {
    sectionLabel: string;
}

export function LiffHeader({ sectionLabel }: LiffHeaderProps): ReactElement {
    return (
        <header className="sticky top-0 z-30 border-b border-border-subtle/80 bg-surface/95 px-[max(1rem,env(safe-area-inset-left))] pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))]">
            <div className="flex min-h-11 items-center gap-3">
                <Link
                    href={APP_ROUTES.line.root}
                    aria-label="ไปหน้าหลัก NHFapp"
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface p-1.5 shadow-sm transition-[border-color,background-color,box-shadow] hover:border-brand-border-strong hover:bg-brand-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40"
                >
                    <Image
                        src="/NHFapp_logo_v1.png"
                        width={40}
                        height={40}
                        alt="NHFapp"
                        className="size-full rounded-lg object-contain"
                        priority
                    />
                </Link>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold tracking-tight text-content-heading">
                        NHFapp
                    </p>
                    <p className="truncate text-xs font-medium leading-5 text-content-muted">
                        {sectionLabel}
                    </p>
                </div>
            </div>
        </header>
    );
}
