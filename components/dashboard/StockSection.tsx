"use client";

import { Package, ShoppingCart, ClipboardList, Boxes, FileText } from "lucide-react";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import { StockProvider, useStockDataContext, useStockUIContext } from "./context/stock";
import {
    StockBrowse,
    StockMyRequests,
    StockAdminInventory,
    StockAdminRequests,
} from "./stock";

function StockContent() {
    const { isAdmin } = useStockDataContext();
    const { activeTab, setActiveTab } = useStockUIContext();

    const tabs: SectionTabItem[] = [
        {
            value: "browse",
            label: "เบิกวัสดุ",
            icon: ShoppingCart,
            content: <StockBrowse />,
        },
        {
            value: "my-requests",
            label: "ประวัติการเบิก",
            icon: FileText,
            content: <StockMyRequests />,
        },
        {
            value: "inventory",
            label: "จัดการสต็อค",
            icon: Boxes,
            content: <StockAdminInventory />,
            visible: isAdmin,
        },
        {
            value: "admin-requests",
            label: "คำขอเบิก",
            icon: ClipboardList,
            content: <StockAdminRequests />,
            visible: isAdmin,
        },
    ];

    return (
        <SectionShell
            gradientFrom="rgba(204,251,241,0.6)"
            gradientTo="rgba(209,250,229,0.6)"
        >
            <SectionHeader
                icon={Package}
                title="ระบบสต็อค"
                subtitle="เบิกจ่ายวัสดุสำนักงาน"
                iconGradient="from-orange-500 to-red-600"
                iconGlow="from-orange-500/40 to-red-500/40"
                iconShadow="shadow-orange-500/25"
                badgeColor="bg-orange-50 text-orange-700 border-orange-100"
                roleBadge={isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
            />
            <SectionTabs
                value={activeTab}
                onValueChange={setActiveTab}
                tabs={tabs}
                activeColor="#ea580c"
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
