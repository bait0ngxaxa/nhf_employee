import type { Metadata } from "next";

import { StockRouteContent } from "./StockRouteContent";

export const metadata: Metadata = {
    title: "Stock | NHFapp",
};

export default function StockDashboardPage() {
    return <StockRouteContent />;
}
