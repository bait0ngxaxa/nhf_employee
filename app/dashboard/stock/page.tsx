import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { canAccessStockDashboard } from "@/constants/dashboard";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { StockRouteContent } from "./StockRouteContent";

export const metadata: Metadata = {
    title: "Stock | NHFapp",
};

export default async function StockDashboardPage(): Promise<React.ReactElement> {
    const user = await getCurrentUserProjection();
    if (!user) {
        redirect(APP_ROUTES.login);
    }
    if (!canAccessStockDashboard(user.stockCapabilities)) {
        redirect(APP_ROUTES.accessDenied);
    }

    return <StockRouteContent />;
}
