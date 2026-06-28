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
            className="flex min-h-svh items-center justify-center bg-slate-50 p-6"
        >
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
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
