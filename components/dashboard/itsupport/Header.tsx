"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { useITSupportDataContext } from "../context";

export const Header = memo(function Header() {
    const { session, isAdmin } = useITSupportDataContext();

    if (!session) return null;

    return (
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    IT Support System
                </h2>
                <p className="text-gray-600">
                    ระบบแจ้งปัญหาและติดตามการแก้ไขปัญหาไอที
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                    {isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                </Badge>
                <Badge variant="outline" className="text-sm">
                    {session.user?.department}
                </Badge>
            </div>
        </div>
    );
});
