import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardProvider } from "@/components/dashboard/context";
import { DashboardLayoutClient } from "@/components/dashboard/DashboardLayoutClient";
import { getApiAuthSession } from "@/lib/server-auth";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getApiAuthSession();

    if (!session) {
        redirect("/login");
    }

    return (
        <Suspense>
            <DashboardProvider>
                <DashboardLayoutClient>{children}</DashboardLayoutClient>
            </DashboardProvider>
        </Suspense>
    );
}
