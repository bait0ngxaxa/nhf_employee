"use client";

import { useEffect, useState } from "react";
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
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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
            gradientFrom="transparent"
            gradientTo="transparent"
            className="border-slate-200/70 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)]"
        >
            <SectionHeader
                icon={Package}
                title="NHF Stock"
                subtitle="เบิกจ่ายวัสดุสำนักงาน"
                iconGradient="from-orange-500 to-red-600"
                iconGlow="from-orange-500/40 to-red-500/30"
                iconShadow="shadow-orange-500/25"
                badgeColor="bg-orange-50 text-orange-700 border-orange-100"
                roleBadge={isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
            />
            {isMounted ? (
                <SectionTabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    tabs={tabs}
                    activeColor="#ea580c"
                />
            ) : (
                <StockBrowse />
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
