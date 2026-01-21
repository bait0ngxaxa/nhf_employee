"use client";

import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { AddEmployeeForm } from "@/components/employee";
import { useDashboardContext } from "./context";

export function AddEmployeeSection() {
    const { handleMenuClick, handleEmployeeAdded } = useDashboardContext();

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <Button
                    variant="outline"
                    onClick={() => handleMenuClick("employee-management")}
                    className="flex items-center space-x-2"
                >
                    <Users className="h-4 w-4" />
                    <span>กลับไปรายชื่อ</span>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        เพิ่มพนักงานใหม่
                    </h2>
                    <p className="text-gray-600">
                        เพิ่มข้อมูลพนักงานใหม่เข้าระบบ
                    </p>
                </div>
            </div>
            <AddEmployeeForm onSuccess={handleEmployeeAdded} />
        </div>
    );
}
