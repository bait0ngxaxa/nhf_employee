import { Suspense } from "react";
import { type Metadata } from "next";
import { AuthPageShell, ResetPasswordForm } from "@/modules/auth/client";

export const metadata: Metadata = {
    title: "ตั้งรหัสผ่านใหม่ | NHFapp",
};

function ResetPasswordContent() {
    return (
        <AuthPageShell>
            <ResetPasswordForm />
        </AuthPageShell>
    );
}

export default function Page() {
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
                <ResetPasswordContent />
            </Suspense>
        </div>
    );
}
