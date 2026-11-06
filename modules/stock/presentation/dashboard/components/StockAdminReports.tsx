"use client";

import { useState, type ReactElement } from "react";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StockRawDataExport } from "./StockRawDataExport";
import { StockAnalyticsOverview } from "./StockAnalyticsOverview";

export function StockAdminReports({ canExportReports, canReadReports = false, onInventory }: { canExportReports: boolean; canReadReports?: boolean; onInventory?: (sku: string) => void }): ReactElement {
    const [view, setView] = useState("overview");
    if (!canReadReports) return <StockRawDataExport canExportReports={canExportReports} />;
    const active = canReadReports ? (canExportReports ? view : "overview") : "export";
    return <SectionTabs value={active} onValueChange={setView} activeColor="var(--module-stock-tab)" tabs={[
        { value: "overview", label: "ภาพรวม", visible: canReadReports, content: <StockAnalyticsOverview onInventory={onInventory} /> },
        { value: "export", label: "ส่งออกข้อมูลดิบ", visible: canExportReports, content: <StockRawDataExport canExportReports={canExportReports} /> },
    ]} />;
}
