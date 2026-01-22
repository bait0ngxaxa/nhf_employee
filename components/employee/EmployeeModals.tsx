"use client";

import { EditEmployeeForm } from "@/components/employee";
import { SuccessModal } from "@/components/SuccessModal";
import { useEmployeeUIContext } from "@/components/dashboard/context/employee/EmployeeContext";

export function EmployeeModals() {
    const {
        isEditFormOpen,
        employeeToEdit,
        handleCloseEditForm,
        handleEmployeeUpdate,
        showEditSuccessModal,
        setShowEditSuccessModal,
        lastEditedEmployee,
    } = useEmployeeUIContext();

    return (
        <>
            {/* Edit Employee Form */}
            <EditEmployeeForm
                employee={employeeToEdit}
                isOpen={isEditFormOpen}
                onClose={handleCloseEditForm}
                onSuccess={handleEmployeeUpdate}
            />

            {/* Edit Employee Success Modal */}
            <SuccessModal
                isOpen={showEditSuccessModal}
                onClose={() => setShowEditSuccessModal(false)}
                title="แก้ไขข้อมูลสำเร็จ!"
                description={
                    lastEditedEmployee
                        ? `ข้อมูลของ ${lastEditedEmployee.firstName} ${lastEditedEmployee.lastName} ได้รับการอัปเดตเรียบร้อยแล้ว`
                        : "ข้อมูลพนักงานได้รับการอัปเดตเรียบร้อยแล้ว"
                }
            />
        </>
    );
}
