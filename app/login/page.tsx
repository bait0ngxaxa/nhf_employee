import { LoginForm } from "@/components/auth";
import { Suspense } from "react";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { getApiAuthSession } from "@/lib/server-auth";
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

export default async function Page() {
    const session = await getApiAuthSession();
    if (session) {
        redirect(APP_ROUTES.dashboard);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <Suspense
                fallback={
                    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
                        <div className="w-full max-w-sm">
                            <div className="animate-pulse">
                                <div className="h-8 bg-gray-200 rounded mb-4" />
                                <div className="h-32 bg-gray-200 rounded" />
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
