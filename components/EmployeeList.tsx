"use client";

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
import { EditEmployeeForm } from "@/components/EditEmployeeForm";
import { SuccessModal } from "@/components/SuccessModal";
import { EmployeeTable } from "@/components/EmployeeTable";
import { Pagination } from "@/components/Pagination";
import { EmployeeListProps } from "@/types/employees";
import { STATUS_FILTER_OPTIONS } from "@/constants/ui";
import { getEmployeeStatusLabel } from "@/lib/helpers/employee-helpers";
import { useEmployeeList } from "@/hooks/useEmployeeList";

export function EmployeeList({ refreshTrigger, userRole }: EmployeeListProps) {
    const {
        employees,
        filteredEmployees,
        currentEmployees,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        currentPage,
        totalPages,
        itemsPerPage,
        startIndex,
        endIndex,
        handlePageChange,
        handlePreviousPage,
        handleNextPage,
        isLoading,
        error,
        isExporting,
        prepareCsvData,
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

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">
                    กำลังโหลดข้อมูลพนักงาน...
                </span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-8">
                <div className="text-red-600 bg-red-50 p-4 rounded-md">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
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

                {filteredEmployees.length > 0 && (
                    <CSVLink
                        data={prepareCsvData()}
                        filename={getExportFileName()}
                        className="inline-flex"
                        onClick={handleExportCSV}
                    >
                        <Button
                            variant="outline"
                            className="flex items-center space-x-2 whitespace-nowrap"
                            disabled={isExporting}
                        >
                            <Download className="h-4 w-4" />
                            <span>
                                {isExporting
                                    ? "กำลังเตรียม..."
                                    : `Export CSV (${filteredEmployees.length} คน)`}
                            </span>
                        </Button>
                    </CSVLink>
                )}
            </div>

            {/* Results Summary */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                <div className="text-sm text-gray-600">
                    แสดงผล {startIndex + 1}-
                    {Math.min(endIndex, filteredEmployees.length)} จาก{" "}
                    {filteredEmployees.length} คน
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
                    <span className="text-gray-500">
                        (ทั้งหมด {employees.length} คน)
                    </span>
                </div>
                {totalPages > 1 && (
                    <div className="text-sm text-gray-600">
                        หน้า {currentPage} จาก {totalPages}
                    </div>
                )}
            </div>

            {/* Employee Table */}
            {filteredEmployees.length === 0 ? (
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
