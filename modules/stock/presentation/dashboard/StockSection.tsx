"use client";

import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import { StockProvider } from "./context/StockProvider";
import {
    useStockDataContext,
    useStockUIContext,
} from "./context/StockContext";
import { StockBrowse } from "./components/StockBrowse";
import { StockMyRequests } from "./components/StockMyRequests";
import { StockAdminInventory } from "./components/StockAdminInventory";
import { StockAdminRequests } from "./components/StockAdminRequests";
import { StockAdminReports } from "./components/StockAdminReports";

function StockContent() {
    const { isAdmin, stockCapabilities } = useStockDataContext();
    const { activeTab, setActiveTab } = useStockUIContext();

    const canReadCatalog = stockCapabilities.canReadCatalog;
    const canReadOwnRequests = stockCapabilities.canReadOwnRequests;
    const canReadAllRequests = stockCapabilities.canReadAllRequests;
    const canManageInventory = stockCapabilities.canManageInventory;
    const canExportReports = stockCapabilities.canExportReports;
    const hasUsableTab = canReadCatalog
        || canReadOwnRequests
        || canReadAllRequests
        || canExportReports;

    const tabs: SectionTabItem[] = [
        {
            value: "browse",
            label: "เบิกวัสดุ",
            group: "work",
            visible: canReadCatalog,
            content: <StockBrowse />,
        },
        {
            value: "my-requests",
            label: "ประวัติการเบิก",
            group: "work",
            visible: canReadOwnRequests,
            content: <StockMyRequests />,
        },
        {
            value: "inventory",
            label: "จัดการสต็อก",
            group: "admin",
            groupLabel: "ผู้ดูแล",
            content: <StockAdminInventory />,
            visible: canReadCatalog && canManageInventory,
        },
        {
            value: "admin-requests",
            label: "คำขอเบิก",
            group: "admin",
            content: <StockAdminRequests />,
            visible: canReadAllRequests,
        },
        {
            value: "reports",
            label: "รายงาน",
            group: "admin",
            content: <StockAdminReports canExportReports={canExportReports} />,
            visible: canExportReports,
        },
    ];

    return (
        <SectionShell className="border-border-subtle/70 bg-surface">
            <SectionHeader
                title="NHF Stock"
                subtitle="เบิกจ่ายวัสดุสำนักงาน"
                roleBadge={isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                badgeColor="bg-module-stock-badge-surface text-module-stock-badge-foreground border-module-stock-badge-border"
            />
            {hasUsableTab ? (
                <SectionTabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    tabs={tabs}
                    activeColor="var(--module-stock-tab)"
                />
            ) : (
                <div
                    className="border-y border-status-warning-border bg-status-warning-surface px-4 py-5 text-sm leading-6 text-status-warning-strong"
                    role="status"
                >
                    บัญชีนี้ยังไม่มีสิทธิ์ใช้งานส่วน Stock ที่เปิดอยู่
                </div>
            )}
        </SectionShell>
    );
}

export function StockSection() {
    return (
        <StockProvider>
            <StockContent />
        </StockProvider>
    );
}
