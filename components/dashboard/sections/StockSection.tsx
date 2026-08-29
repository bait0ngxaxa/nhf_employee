"use client";

import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import { StockProvider } from "@/components/dashboard/context/stock/StockProvider";
import {
    useStockDataContext,
    useStockUIContext,
} from "@/components/dashboard/context/stock/StockContext";
import { StockBrowse } from "@/components/dashboard/stock/StockBrowse";
import { StockMyRequests } from "@/components/dashboard/stock/StockMyRequests";
import { StockAdminInventory } from "@/components/dashboard/stock/StockAdminInventory";
import { StockAdminRequests } from "@/components/dashboard/stock/StockAdminRequests";
import { StockAdminReports } from "@/components/dashboard/stock/StockAdminReports";

function StockContent() {
    const { isAdmin } = useStockDataContext();
    const { activeTab, setActiveTab } = useStockUIContext();

    const tabs: SectionTabItem[] = [
        {
            value: "browse",
            label: "เบิกวัสดุ",
            content: <StockBrowse />,
        },
        {
            value: "my-requests",
            label: "ประวัติการเบิก",
            content: <StockMyRequests />,
        },
        {
            value: "inventory",
            label: "จัดการสต็อค",
            content: <StockAdminInventory />,
            visible: isAdmin,
        },
        {
            value: "admin-requests",
            label: "คำขอเบิก",
            content: <StockAdminRequests />,
            visible: isAdmin,
        },
        {
            value: "reports",
            label: "รีพอร์ต",
            content: <StockAdminReports />,
            visible: isAdmin,
        },
    ];

    return (
        <SectionShell className="border-border-subtle/70 bg-surface shadow-sm">
            <SectionHeader
                title="NHF Stock"
                subtitle="เบิกจ่ายวัสดุสำนักงาน"
                roleBadge={isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                badgeColor="bg-module-stock-badge-surface text-module-stock-badge-foreground border-module-stock-badge-border"
            />
            <SectionTabs
                value={activeTab}
                onValueChange={setActiveTab}
                tabs={tabs}
                activeColor="var(--module-stock-tab)"
            />
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
