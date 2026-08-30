import type { ReactElement, ReactNode } from "react";
import { Suspense } from "react";

import { LiffBootstrap } from "@/components/liff/LiffBootstrap";
import { LiffAppShell } from "@/components/liff/LiffAppShell";

export default function LiffLayout({
    children,
}: Readonly<{ children: ReactNode }>): ReactElement {
    return (
        <Suspense
            fallback={
                <main
                    id="main"
                    className="flex min-h-svh items-center justify-center bg-surface-subtle pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] text-center text-sm font-medium text-content-secondary"
                    role="status"
                >
                    กำลังเตรียมบริการ NHFapp ผ่าน LINE...
                </main>
            }
        >
            <LiffBootstrap>
                <LiffAppShell>{children}</LiffAppShell>
            </LiffBootstrap>
        </Suspense>
    );
}
