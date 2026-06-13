import { Suspense } from "react";
import { type Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
    title: "ตั้งรหัสผ่านใหม่ | NHFapp",
};

function ResetPasswordContent() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm">
                <ResetPasswordForm />
            </div>
        </div>
    );
}

export default function Page() {
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
                <ResetPasswordContent />
            </Suspense>
        </div>
    );
}
