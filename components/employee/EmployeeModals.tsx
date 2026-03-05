"use client";

import { EditEmployeeForm } from "@/components/employee";
import { useEmployeeUIContext } from "@/components/dashboard/context/employee/EmployeeContext";

export function EmployeeModals() {
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
            />
        </>
    );
}