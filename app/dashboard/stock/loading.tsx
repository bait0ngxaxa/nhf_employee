import type { ReactElement } from "react";

import { StockSectionSkeleton } from "@/modules/stock/client";

export default function StockLoading(): ReactElement {
    return <StockSectionSkeleton />;
}
