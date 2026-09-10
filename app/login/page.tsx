import { LoginForm } from "@/modules/auth/client";
import { Suspense } from "react";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { resolveSafeInternalPath } from "@/lib/auth/return-path";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { AuthPageShell } from "@/modules/auth/client";

export const metadata: Metadata = {
    title: "เข้าสู่ระบบ | NHFapp",
};

function LoginPageContent() {
    return (
        <AuthPageShell>
            <LoginForm />
        </AuthPageShell>
    );
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await getCurrentUserProjection();
    if (user) {
        const params = await searchParams;
        const returnTo = typeof params.returnTo === "string"
            ? params.returnTo
            : undefined;
        redirect(resolveSafeInternalPath(returnTo, APP_ROUTES.dashboard));
    }

    return (
        <div className="app-shell-background min-h-screen">
            <Suspense
                fallback={
                    <AuthPageShell>
                        <div className="animate-pulse">
                            <div className="mb-4 h-8 rounded bg-surface-neutral-border" />
                            <div className="h-32 rounded bg-surface-neutral-border" />
                        </div>
                    </AuthPageShell>
                }
            >
                <LoginPageContent />
            </Suspense>
        </div>
    );
}
