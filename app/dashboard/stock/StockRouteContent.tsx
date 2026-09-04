"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

import { StockSectionSkeleton } from "@/modules/stock/client";

const StockSection = dynamic(
    () => import("@/modules/stock/client").then((module) => module.StockSection),
    {
        // Stock presentation initializes browser storage and portal-based UI, so retain
        // the legacy no-SSR behavior at this route boundary.
        loading: () => <StockSectionSkeleton />,
        ssr: false,
    },
);

export function StockRouteContent(): ReactElement {
    return <StockSection />;
}
