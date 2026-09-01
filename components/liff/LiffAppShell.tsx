"use client";

import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { LiffBottomNav } from "@/components/liff/LiffBottomNav";
import { LiffHeader } from "@/components/liff/LiffHeader";
import { APP_ROUTES } from "@/lib/ssot/routes";

interface LiffAppShellProps {
    children: ReactNode;
}

function getSectionLabel(pathname: string | null): string {
    if (pathname === APP_ROUTES.line.stock
        || pathname?.startsWith(`${APP_ROUTES.line.stock}/`)) {
        return "Stock · บริการวัสดุ";
    }
    if (pathname === APP_ROUTES.line.leave
        || pathname?.startsWith(`${APP_ROUTES.line.leave}/`)) {
        return "Leave · บริการวันลา";
    }
    if (pathname === APP_ROUTES.line.routine
        || pathname?.startsWith(`${APP_ROUTES.line.routine}/`)) {
        return "Routine · งานประจำ";
    }
    return "บริการของฉัน";
}

export function LiffAppShell({ children }: LiffAppShellProps): ReactElement {
    const pathname = usePathname();

    return (
        <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] overflow-x-hidden supports-[overflow:clip]:overflow-x-clip bg-surface-subtle text-content-body">
            <div className="mx-auto flex min-h-screen supports-[height:100dvh]:min-h-[100dvh] w-full max-w-lg flex-col bg-surface">
                <LiffHeader sectionLabel={getSectionLabel(pathname)} />
                <div className="min-w-0 flex-1">{children}</div>
                <LiffBottomNav pathname={pathname} />
            </div>
        </div>
    );
}
