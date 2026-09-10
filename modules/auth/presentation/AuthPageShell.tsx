import type { ReactElement, ReactNode } from "react";

import { AppLogo } from "@/components/brand/AppLogo";

interface AuthPageShellProps {
    children: ReactNode;
}

export function AuthPageShell({ children }: AuthPageShellProps): ReactElement {
    return (
        <main
            id="main"
            className="flex min-h-svh w-full items-center justify-center px-6 py-10 md:px-10"
        >
            <div className="w-full max-w-md">
                <div className="mb-6 flex items-center gap-3 px-1">
                    <AppLogo variant="mark" priority className="size-11" />
                    <div className="min-w-0">
                        <p className="text-lg font-bold tracking-tight text-content-heading">
                            NHFapp
                        </p>
                        <p className="text-sm text-content-secondary">
                            ระบบบริการบุคลากร NHF
                        </p>
                    </div>
                </div>
                {children}
            </div>
        </main>
    );
}
