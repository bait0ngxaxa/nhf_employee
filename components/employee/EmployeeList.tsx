"use client";

import { useRef } from "react";
import { CSVLink } from "react-csv";
import { Skeleton } from "@/components/ui/skeleton";
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
        debouncedSearchTerm,

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

    // Show full skeleton only for the very first unfiltered load.
    // Keep search controls mounted during filtering/searching to avoid input focus loss.
    const isInitialLoading =
        isLoading
        && employees.length === 0
        && totalEmployees === 0
        && debouncedSearchTerm.trim().length === 0
        && statusFilter === "all";

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
            <div className="space-y-6 animate-pulse">
                {/* Search Controls Skeleton */}
                <div className="flex flex-wrap gap-3">
                    <Skeleton className="h-10 flex-1 min-w-[200px]" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* Results Summary Skeleton */}
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                </div>

                {/* Table Skeleton */}
                <div className="w-full">
                    <div className="flex gap-4 pb-4 border-b border-gray-100">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 flex-1" />
                        ))}
                    </div>
                    <div className="space-y-4 pt-4">
                        {Array.from({ length: 5 }).map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className="flex gap-4 items-center"
                            >
                                {Array.from({ length: 6 }).map(
                                    (_, colIndex) => (
                                        <Skeleton
                                            key={colIndex}
                                            className="h-12 flex-1"
                                        />
                                    ),
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Calculate display range
    const hasActiveFilters =
        debouncedSearchTerm.trim().length > 0 || statusFilter !== "all";
    const startIndex =
        totalEmployees === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex =
        totalEmployees === 0
            ? 0
            : Math.min((currentPage - 1) * itemsPerPage + employees.length, totalEmployees);
    const emptyMessage = error
        ? error
        : hasActiveFilters
          ? "ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหาหรือการกรอง"
          : "ยังไม่มีข้อมูลพนักงาน";

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
                    แสดงผล {startIndex}-{endIndex} จาก {totalEmployees} คน
                    {statusFilter !== "all" ? (
                        <span className="text-blue-600">
                            (กรองตามสถานะ:{" "}
                            {getEmployeeStatusLabel(statusFilter)})
                        </span>
                    ) : null}
                    {debouncedSearchTerm ? (
                        <span className="text-green-600">
                            (ค้นหา: &quot;{debouncedSearchTerm}&quot;)
                        </span>
                    ) : null}
                </div>
                {totalPages > 1 ? (
                    <div className="text-sm text-gray-600">
                        หน้า {currentPage} จาก {totalPages}
                    </div>
                ) : null}
            </div>

            {/* Employee Table */}
            {employees.length === 0 ? (
                <div
                    className={`rounded-xl border p-8 text-center ${
                        error
                            ? "border-red-200 bg-red-50 text-red-600"
                            : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                >
                    {emptyMessage}
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
