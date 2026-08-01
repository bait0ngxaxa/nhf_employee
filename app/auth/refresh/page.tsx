import type { Metadata } from "next";
import { Suspense } from "react";

import { RefreshSessionBridge } from "@/components/auth/RefreshSessionBridge";

export const metadata: Metadata = {
    title: "ตรวจสอบสิทธิ์ | NHFapp",
};

function LoadingFallback(): React.ReactElement {
    return (
        <main
            id="main"
            className="flex min-h-svh items-center justify-center bg-surface-subtle p-6"
        >
            <div className="rounded-xl border border-border-subtle bg-surface-raised px-5 py-4 text-sm font-semibold text-content-body shadow-sm">
                กำลังตรวจสอบสิทธิ์
            </div>
        </main>
    );
}

export default function RefreshAuthPage(): React.ReactElement {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <RefreshSessionBridge />
        </Suspense>
    );
}
