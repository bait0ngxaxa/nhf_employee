"use client";

import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { AddEmployeeForm } from "@/components/employee";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

export function AddEmployeeSection() {
    const { handleMenuClick } = useDashboardUIContext();
    const { handleEmployeeAdded } = useDashboardDataContext();

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(224,231,255,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(243,232,255,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <div className="flex items-center space-x-5">
                        <div className="relative group cursor-default">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-indigo-500/40 to-purple-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                            <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                                <UserPlus className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                                เพิ่มพนักงานใหม่
                            </h2>
                            <p className="text-gray-500 font-medium">
                                เพิ่มข้อมูลพนักงานใหม่เข้าระบบ
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => handleMenuClick("employee-management")}
                        className="flex items-center space-x-2 bg-white/95 hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm rounded-xl"
                    >
                        <Users className="h-4 w-4" />
                        <span>กลับไปรายชื่อ</span>
                    </Button>
                </div>
                
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    <AddEmployeeForm onSuccess={handleEmployeeAdded} />
                </div>
            </div>
        </div>
    );
}
