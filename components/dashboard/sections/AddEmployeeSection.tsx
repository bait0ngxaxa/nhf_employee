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
        <div className="min-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="space-y-8 p-4 md:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="shrink-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600">
                                <UserPlus className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="min-w-0 space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] md:text-3xl">
                                เพิ่มพนักงานใหม่
                            </h2>
                            <p className="text-sm font-medium leading-6 text-slate-600 [overflow-wrap:anywhere]">
                                เพิ่มข้อมูลพนักงานใหม่เข้าระบบ
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => handleMenuClick("employee-management")}
                        className="h-11 w-full justify-center gap-2 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
                    >
                        <Users className="h-4 w-4" />
                        <span>กลับไปรายชื่อ</span>
                    </Button>
                </div>

                <div className="space-y-8">
                    <AddEmployeeForm onSuccess={handleEmployeeAdded} />
                </div>
            </div>
        </div>
    );
}
