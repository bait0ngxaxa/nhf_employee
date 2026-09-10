import { Suspense } from "react";
import { type Metadata } from "next";
import { AuthPageShell, ForgotPasswordForm } from "@/modules/auth/client";

export const metadata: Metadata = {
    title: "ลืมรหัสผ่าน | NHFapp",
};

function ForgotPasswordContent() {
    return (
        <AuthPageShell>
            <ForgotPasswordForm />
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
                <ForgotPasswordContent />
            </Suspense>
        </div>
    );
}
