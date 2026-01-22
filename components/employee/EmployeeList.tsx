"use client";

import { useRef } from "react";
import { CSVLink } from "react-csv";
import {
    EmployeeTable,
    EmployeeSearchControls,
    EmployeeModals,
} from "@/components/employee";
import { Pagination } from "@/components/Pagination";
import { type EmployeeListProps } from "@/types/employees";

import { getEmployeeStatusLabel } from "@/lib/helpers/employee-helpers";
import {
    useEmployeeDataContext,
    useEmployeeUIContext,
} from "@/components/dashboard/context/employee/EmployeeContext";

export function EmployeeList({ userRole }: EmployeeListProps) {
    const csvLinkRef = useRef<
        CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement }
    >(null);

    const {
        employees,
        currentEmployees,
        totalEmployees,
        totalPages,
        isLoading,
        error,
    } = useEmployeeDataContext();

    const {
        searchTerm,

        statusFilter,

        currentPage,
        itemsPerPage,
        handlePageChange,
        handlePreviousPage,
        handleNextPage,

        getExportData,
        getExportFileName,
        handleExportCSV,

        handleEditEmployee,
    } = useEmployeeUIContext();

    // Don't show loading screen for subsequent loads to prevent focus loss
    const isInitialLoading = isLoading && employees.length === 0;

    // Handle export button click - fetch data then trigger CSV download
    const onExportClick = async () => {
        await handleExportCSV();
        // Wait a bit for state to update, then trigger download
        setTimeout(() => {
            csvLinkRef.current?.link.click();
        }, 100);
    };

    if (isInitialLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span className="ml-2 text-gray-600">
                    กำลังโหลดข้อมูลพนักงาน...
                </span>
            </div>
        );
    }

    if (error && employees.length === 0) {
        return (
            <div className="text-center p-8">
                <div className="text-red-600 bg-red-50 p-4 rounded-md">
                    {error}
                </div>
            </div>
        );
    }

    // Calculate display range
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + employees.length, totalEmployees);

    return (
        <div className="space-y-6">
            {/* Hidden CSVLink for async download trigger */}
            <CSVLink
                ref={csvLinkRef}
                data={getExportData()}
                filename={getExportFileName()}
                className="hidden"
            />

            {/* Search, Filter and Export Controls */}
            <EmployeeSearchControls onExportClick={onExportClick} />

            {/* Results Summary */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                <div className="text-sm text-gray-600">
                    แสดงผล {startIndex + 1}-{endIndex} จาก {totalEmployees} คน
                    {statusFilter !== "all" && (
                        <span className="text-blue-600">
                            (กรองตามสถานะ:{" "}
                            {getEmployeeStatusLabel(statusFilter)})
                        </span>
                    )}
                    {searchTerm && (
                        <span className="text-green-600">
                            (ค้นหา: &quot;{searchTerm}&quot;)
                        </span>
                    )}
                </div>
                {totalPages > 1 && (
                    <div className="text-sm text-gray-600">
                        หน้า {currentPage} จาก {totalPages}
                    </div>
                )}
            </div>

            {/* Employee Table */}
            {employees.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    {searchTerm || statusFilter !== "all"
                        ? "ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหาหรือการกรอง"
                        : "ยังไม่มีข้อมูลพนักงาน"}
                </div>
            ) : (
                <EmployeeTable
                    employees={currentEmployees}
                    userRole={userRole}
                    onEditEmployee={handleEditEmployee}
                />
            )}

            {/* Pagination Controls */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onPreviousPage={handlePreviousPage}
                onNextPage={handleNextPage}
            />

            {/* Modals */}
            <EmployeeModals />
        </div>
    );
}
