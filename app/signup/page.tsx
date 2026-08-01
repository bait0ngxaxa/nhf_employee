import { SignupForm } from "@/components/auth";

export default function Page() {
    return (
        <div className="app-shell-background min-h-screen">
            <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
                <div className="w-full max-w-sm">
                    <SignupForm />
                </div>
            </div>
        </div>
    );
}
