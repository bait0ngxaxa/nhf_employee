"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { refreshHybridSession } from "@/lib/auth/client";
import { APP_ROUTES } from "@/lib/ssot/routes";

function isSafeInternalPath(value: string | null): value is string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return false;
    }
    return !value.includes("://");
}

function resolveNextPath(value: string | null): string {
    return isSafeInternalPath(value) ? value : APP_ROUTES.dashboard;
}

export function RefreshSessionBridge(): React.ReactElement {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [message, setMessage] = useState("กำลังตรวจสอบสิทธิ์");
    const nextPath = useMemo(
        () => resolveNextPath(searchParams.get("next")),
        [searchParams],
    );

    useEffect(() => {
        let isCancelled = false;

        void (async () => {
            const refreshed = await refreshHybridSession();
            if (isCancelled) {
                return;
            }

            if (refreshed) {
                setMessage("กำลังเข้าสู่ระบบ");
                router.replace(nextPath);
                router.refresh();
                return;
            }

            setMessage("กรุณาเข้าสู่ระบบใหม่");
            router.replace(APP_ROUTES.login);
        })();

        return () => {
            isCancelled = true;
        };
    }, [nextPath, router]);

    return (
        <main
            id="main"
            className="flex min-h-svh items-center justify-center bg-slate-50 p-6"
        >
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
                <p>{message}</p>
            </div>
        </main>
    );
}
