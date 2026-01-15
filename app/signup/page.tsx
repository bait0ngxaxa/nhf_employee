import { SignupForm } from "@/components/auth";

export default function Page() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-200/30 rounded-full blur-3xl"></div>
                </div>

                <div className="w-full max-w-sm relative z-10">
                    <SignupForm />
                </div>
            </div>
        </div>
    );
}
