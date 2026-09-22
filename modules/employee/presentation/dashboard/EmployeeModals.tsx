"use client";

import { EditEmployeeForm } from "./edit-employee";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import type { Employee } from "./types";

interface EmployeeModalsProps {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function EmployeeModals({
    employee,
    isOpen,
    onClose,
    onSuccess,
}: EmployeeModalsProps) {
    const { user } = useDashboardDataContext();

    return (
        <>
            {/* Edit Employee Form */}
            <EditEmployeeForm
                key={employee?.id || "new"}
                employee={employee}
                isOpen={isOpen}
                onClose={onClose}
                onSuccess={onSuccess}
                canReadDepartments={user?.departmentCapabilities?.canReadDepartments === true}
            />
        </>
    );
}
