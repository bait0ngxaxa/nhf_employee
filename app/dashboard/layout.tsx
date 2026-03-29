import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardProvider } from "@/components/dashboard/context";
import { DashboardLayoutClient } from "@/components/dashboard/DashboardLayoutClient";
import { getApiAuthSession } from "@/lib/server-auth";
import { APP_ROUTES } from "@/lib/ssot/routes";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getApiAuthSession();

    if (!session) {
        redirect(APP_ROUTES.login);
    }

    return (
        <Suspense>
            <DashboardProvider initialUser={session.user}>
                <DashboardLayoutClient>{children}</DashboardLayoutClient>
            </DashboardProvider>
        </Suspense>
    );
}
