import { LoginForm } from "@/components/auth";
import { Suspense } from "react";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { getApiAuthSession } from "@/lib/auth/server";
import { resolveSafeInternalPath } from "@/lib/auth/return-path";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "เข้าสู่ระบบ | NHFapp",
};

function LoginPageContent() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm">
                <LoginForm />
            </div>
        </div>
    );
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const session = await getApiAuthSession();
    if (session) {
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
                    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
                        <div className="w-full max-w-sm">
                            <div className="animate-pulse">
                <div className="mb-4 h-8 rounded bg-surface-neutral-border" />
                <div className="h-32 rounded bg-surface-neutral-border" />
                            </div>
                        </div>
                    </div>
                }
            >
                <LoginPageContent />
            </Suspense>
        </div>
    );
}
