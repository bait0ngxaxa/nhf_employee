"use client";

import { EditEmployeeForm } from "./edit-employee";
import { useEmployeeUIContext } from "./context/EmployeeContext";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";

export function EmployeeModals() {
    const { user } = useDashboardDataContext();
    const {
        isEditFormOpen,
        employeeToEdit,
        handleCloseEditForm,
        handleEmployeeUpdate,
    } = useEmployeeUIContext();

    return (
        <>
            {/* Edit Employee Form */}
            <EditEmployeeForm
                key={employeeToEdit?.id || "new"}
                employee={employeeToEdit}
                isOpen={isEditFormOpen}
                onClose={handleCloseEditForm}
                onSuccess={handleEmployeeUpdate}
                canReadDepartments={user?.departmentCapabilities?.canReadDepartments === true}
            />
        </>
    );
}
