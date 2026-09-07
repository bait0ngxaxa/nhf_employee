import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardProvider } from "@/components/dashboard/context";
import { DashboardLayoutClient } from "@/components/dashboard/layout/DashboardLayoutClient";
import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { APP_ROUTES } from "@/lib/ssot/routes";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    return (
        <Suspense>
            <DashboardProvider initialUser={user}>
                <DashboardLayoutClient>{children}</DashboardLayoutClient>
            </DashboardProvider>
        </Suspense>
    );
}
