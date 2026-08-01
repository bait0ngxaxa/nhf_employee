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
            tone="it"
            roleBadge={isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
            extra={
                <Badge
                    variant="outline"
                    className="max-w-[150px] truncate rounded-full border-border-neutral bg-surface/50 px-3 py-1 text-sm font-medium tracking-wide text-content-neutral-secondary backdrop-blur-sm"
                >
                    {session.user?.department}
                </Badge>
            }
        />
    );
});
