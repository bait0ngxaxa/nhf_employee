import { Suspense } from "react";
import { type Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
    title: "ลืมรหัสผ่าน | NHFapp",
};

function ForgotPasswordContent() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm">
                <ForgotPasswordForm />
            </div>
        </div>
    );
}

export default function Page() {
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
                <ForgotPasswordContent />
            </Suspense>
        </div>
    );
}
