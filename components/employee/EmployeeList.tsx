"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, Download, Filter } from "lucide-react";
import { CSVLink } from "react-csv";
import { EditEmployeeForm, EmployeeTable } from "@/components/employee";
import { SuccessModal } from "@/components/SuccessModal";
import { Pagination } from "@/components/Pagination";
import { type EmployeeListProps } from "@/types/employees";
import { STATUS_FILTER_OPTIONS } from "@/constants/ui";
import { getEmployeeStatusLabel } from "@/lib/helpers/employee-helpers";
import { useEmployeeList } from "@/hooks/useEmployeeList";

export function EmployeeList({ refreshTrigger, userRole }: EmployeeListProps) {
    const csvLinkRef = useRef<
        CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement }
    >(null);

    const {
        employees,
        currentEmployees,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        currentPage,
        totalPages,
        totalEmployees,
        itemsPerPage,
        handlePageChange,
        handlePreviousPage,
        handleNextPage,
        isLoading,
        error,
        isExporting,
        getExportData,
        getExportFileName,
        handleExportCSV,
        isEditFormOpen,
        employeeToEdit,
        showEditSuccessModal,
        lastEditedEmployee,
        handleEditEmployee,
        handleCloseEditForm,
        handleEmployeeUpdate,
        setShowEditSuccessModal,
    } = useEmployeeList(refreshTrigger);

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

            {/* Search Bar, Status Filter and Export */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-3">
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 flex-1">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            type="text"
                            placeholder="ค้นหาพนักงาน (ชื่อ, ชื่อเล่น, อีเมล, ตำแหน่ง, แผนก, สังกัด)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="w-full sm:w-48">
                        <Select
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                        >
                            <SelectTrigger className="w-full">
                                <div className="flex items-center space-x-2">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                    <SelectValue placeholder="กรองตามสถานะ" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_FILTER_OPTIONS.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {employees.length > 0 && (
                    <Button
                        variant="outline"
                        className="flex items-center space-x-2 whitespace-nowrap"
                        disabled={isExporting}
                        onClick={onExportClick}
                    >
                        <Download className="h-4 w-4" />
                        <span>
                            {isExporting
                                ? "กำลังเตรียม..."
                                : `Export CSV (${totalEmployees} คน)`}
                        </span>
                    </Button>
                )}
            </div>

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
        </div>
    );
}
