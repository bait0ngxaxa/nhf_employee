"use client";

import { useState, type ReactElement } from "react";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StockLegacyReports } from "./StockLegacyReports";
import { StockAnalyticsOverview } from "./StockAnalyticsOverview";

export function StockAdminReports({ canExportReports, canReadReports = false, onInventory }: { canExportReports: boolean; canReadReports?: boolean; onInventory?: (sku: string) => void }): ReactElement {
    const [view, setView] = useState("overview");
    if (!canReadReports && !canExportReports) return <></>;
    if (!canReadReports) return <StockLegacyReports canExportReports={canExportReports} />;
    const active = canReadReports ? (canExportReports ? view : "overview") : "export";
    return <SectionTabs value={active} onValueChange={setView} activeColor="var(--module-stock-tab)" tabs={[
        { value: "overview", label: "ภาพรวม", visible: canReadReports, content: <StockAnalyticsOverview onInventory={onInventory} /> },
        { value: "export", label: "รายงาน Excel", visible: canExportReports, content: <StockLegacyReports canExportReports={canExportReports} /> },
    ]} />;
}
