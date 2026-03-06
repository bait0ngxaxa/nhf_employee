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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
                        <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            เพิ่มพนักงานใหม่
                        </h2>
                        <p className="text-gray-600">
                            เพิ่มข้อมูลพนักงานใหม่เข้าระบบ
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={() => handleMenuClick("employee-management")}
                    className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm"
                >
                    <Users className="h-4 w-4" />
                    <span>กลับไปรายชื่อ</span>
                </Button>
            </div>
            <AddEmployeeForm onSuccess={handleEmployeeAdded} />
        </div>
    );
}
