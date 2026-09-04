"use client";

import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useSWRConfig } from "swr";
import { AddEmployeeForm } from "@/components/employee";
import {
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { API_ROUTES } from "@/lib/ssot/routes";

export function AddEmployeeSection() {
    const { handleMenuClick } = useDashboardUIContext();
    const { mutate } = useSWRConfig();

    return (
        <div className="min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle">
            <div className="space-y-8 p-4 md:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 space-y-1">
                        <h1
                            data-page-heading
                            tabIndex={-1}
                            className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl"
                        >
                            เพิ่มพนักงานใหม่
                        </h1>
                        <p className="text-sm font-medium leading-6 text-content-secondary [overflow-wrap:anywhere]">
                            เพิ่มข้อมูลพนักงานใหม่เข้าระบบ
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => handleMenuClick("employee-management")}
                        className="h-11 w-full justify-center gap-2 rounded-xl border-border-subtle bg-surface text-content-body hover:bg-surface-subtle sm:w-auto"
                    >
                        <Users className="h-4 w-4" />
                        <span>กลับไปรายชื่อ</span>
                    </Button>
                </div>

                <div className="space-y-8">
                    <AddEmployeeForm
                        onSuccess={() => {
                            void mutate(API_ROUTES.employees.stats);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
