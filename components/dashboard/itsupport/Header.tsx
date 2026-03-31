"use client";

import { memo } from "react";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useITSupportDataContext } from "../context";

export const Header = memo(function Header() {
    const { session, isAdmin } = useITSupportDataContext();

    if (!session) return null;

    return (
        <SectionHeader
            icon={Settings}
            title="NHF IT-Support"
            subtitle="ระบบแจ้งปัญหาและติดตามการแก้ไขปัญหาไอที"
            iconGradient="from-emerald-500 to-teal-700"
            iconGlow="from-emerald-500/40 to-teal-500/40"
            iconShadow="shadow-emerald-500/25"
            badgeColor="bg-indigo-50 text-indigo-700 border-indigo-100"
            roleBadge={isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
            extra={
                <Badge
                    variant="outline"
                    className="px-3 py-1 text-sm font-medium tracking-wide rounded-full max-w-[150px] truncate border-gray-200 text-gray-600 bg-white/50 backdrop-blur-sm"
                >
                    {session.user?.department}
                </Badge>
            }
        />
    );
});
