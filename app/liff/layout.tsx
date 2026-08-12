import type { ReactElement, ReactNode } from "react";
import { Suspense } from "react";

import { LiffBootstrap } from "@/components/liff/LiffBootstrap";

export default function LiffLayout({
    children,
}: Readonly<{ children: ReactNode }>): ReactElement {
    return (
        <Suspense
            fallback={
                <main
                    id="main"
                    className="flex min-h-svh items-center justify-center bg-surface-subtle px-4 text-sm font-medium text-content-secondary"
                    role="status"
                >
                    กำลังเตรียมบริการ NHFapp ผ่าน LINE...
                </main>
            }
        >
            <LiffBootstrap>{children}</LiffBootstrap>
        </Suspense>
    );
}
