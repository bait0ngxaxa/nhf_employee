"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import { useITSupportDataContext } from "../context";

export const Header = memo(function Header() {
    const { session, isAdmin } = useITSupportDataContext();

    if (!session) return null;

    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
            <div className="flex items-center space-x-5">
                <div className="relative group cursor-default">
                    <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-emerald-500/40 to-teal-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                    <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                        <Settings className="h-7 w-7 text-white" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                        IT Support Tickets
                    </h2>
                    <p className="text-gray-500 font-medium">
                        ระบบแจ้งปัญหาและติดตามการแก้ไขปัญหาไอที
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Badge
                    variant="secondary"
                    className="px-3 py-1 text-sm font-semibold tracking-wide rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                    {isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                </Badge>
                <Badge
                    variant="outline"
                    className="px-3 py-1 text-sm font-medium tracking-wide rounded-full max-w-[150px] truncate border-gray-200 text-gray-600 bg-white/50 backdrop-blur-sm"
                >
                    {session.user?.department}
                </Badge>
            </div>
        </div>
    );
});
