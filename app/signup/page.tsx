import { AuthPageShell, SignupForm } from "@/modules/auth/client";

export default function Page() {
    return (
        <div className="app-shell-background min-h-screen">
            <AuthPageShell>
                <SignupForm />
            </AuthPageShell>
        </div>
    );
}
