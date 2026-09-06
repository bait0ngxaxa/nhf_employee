"use client";

import { EditEmployeeForm } from "./edit-employee";
import { useEmployeeUIContext } from "./context/EmployeeContext";

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
