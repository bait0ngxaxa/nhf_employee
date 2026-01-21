"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { type Employee, type EmployeeCSVData } from "@/types/employees";
import { PAGINATION_DEFAULTS } from "@/constants/ui";
import {
    getEmployeeStatusLabel,
    getEmployeeEmailStatus,
} from "@/lib/helpers/employee-helpers";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { EmployeeContext } from "./EmployeeContext";
import { type EmployeeContextValue } from "./types";

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface EmployeeProviderProps {
    children: ReactNode;
}

const defaultPagination: Pagination = {
    page: 1,
    limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
};

export function EmployeeProvider({ children }: EmployeeProviderProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(PAGINATION_DEFAULTS.ITEMS_PER_PAGE);

    // UI states
    const [isExporting, setIsExporting] = useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
    const [showEditSuccessModal, setShowEditSuccessModal] = useState(false);
    const [lastEditedEmployee, setLastEditedEmployee] = useState<{
        firstName: string;
        lastName: string;
    } | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [exportData, setExportData] = useState<EmployeeCSVData[]>([]);

    const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

    // Prepare SWR key
    const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
    });

    if (debouncedSearchTerm) {
        params.append("search", debouncedSearchTerm);
    }
    if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
    }
    const swrKey = `/api/employees?${params.toString()}`;

    // SWR Hook
    const { data, mutate, isLoading, error: swrError } = useSWR(swrKey);

    const employees = data?.employees || [];
    const pagination = data?.pagination || defaultPagination;
    const error = swrError
        ? swrError.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล"
        : "";

    // Reset page on search/filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter]);

    // Force refresh when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger > 0) {
            mutate();
        }
    }, [refreshTrigger, mutate]);

    const handlePageChange = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);

    const handlePreviousPage = useCallback(() => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages));
    }, [pagination.totalPages]);

    // Export Logic (remains mostly same, uses fetch directly as it's separate query)
    const fetchAllForExport = useCallback(async (): Promise<Employee[]> => {
        const params = new URLSearchParams({
            page: "1",
            limit: "10000",
        });

        if (debouncedSearchTerm) {
            params.append("search", debouncedSearchTerm);
        }
        if (statusFilter && statusFilter !== "all") {
            params.append("status", statusFilter);
        }

        const response = await fetch(`/api/employees?${params}`);
        if (response.ok) {
            const data = await response.json();
            return data.employees;
        }
        return [];
    }, [debouncedSearchTerm, statusFilter]);

    const prepareCsvData = (allEmployees: Employee[]): EmployeeCSVData[] => {
        return allEmployees.map((employee, index) => ({
            ลำดับ: index + 1,
            ชื่อ: employee.firstName,
            นามสกุล: employee.lastName,
            ชื่อเล่น: employee.nickname || "-",
            ตำแหน่ง: employee.position,
            สังกัด: employee.affiliation || "-",
            แผนก: employee.dept.name,
            อีเมล:
                getEmployeeEmailStatus(employee.email) === "temp"
                    ? "-"
                    : employee.email,
            เบอร์โทร: employee.phone || "-",
            สถานะ: getEmployeeStatusLabel(employee.status),
        }));
    };

    const getExportFileName = useCallback(() => {
        const searchSuffix = searchTerm ? `_ค้นหา-${searchTerm}` : "";
        const statusSuffix =
            statusFilter !== "all"
                ? `_สถานะ-${getEmployeeStatusLabel(statusFilter)}`
                : "";
        const prefix = `รายชื่อพนักงาน${searchSuffix}${statusSuffix}`;
        return generateFilename(prefix, "csv");
    }, [searchTerm, statusFilter]);

    const handleExportCSV = useCallback(async (): Promise<
        EmployeeCSVData[]
    > => {
        setIsExporting(true);
        try {
            const allEmployees = await fetchAllForExport();
            const csvData = prepareCsvData(allEmployees);
            setExportData(csvData);

            await fetch("/api/audit-logs/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityType: "Employee",
                    recordCount: allEmployees.length,
                    filters: {
                        search: debouncedSearchTerm || null,
                        status: statusFilter !== "all" ? statusFilter : null,
                    },
                }),
            });

            return csvData;
        } catch (err) {
            console.error("Error fetching for export:", err);
            return [];
        } finally {
            setTimeout(() => setIsExporting(false), 500);
        }
    }, [fetchAllForExport, debouncedSearchTerm, statusFilter]);

    const getExportData = useCallback(() => exportData, [exportData]);

    const handleEditEmployee = useCallback((employee: Employee) => {
        setEmployeeToEdit(employee);
        setIsEditFormOpen(true);
    }, []);

    const handleCloseEditForm = useCallback(() => {
        setIsEditFormOpen(false);
        setEmployeeToEdit(null);
    }, []);

    const handleEmployeeUpdate = useCallback(() => {
        const employeeName = employeeToEdit
            ? {
                  firstName: employeeToEdit.firstName,
                  lastName: employeeToEdit.lastName,
              }
            : null;

        setIsEditFormOpen(false);
        setEmployeeToEdit(null);

        setTimeout(() => {
            if (employeeName) {
                setLastEditedEmployee(employeeName);
            }
            setShowEditSuccessModal(true);
        }, 100);

        mutate(); // Revalidate SWR
    }, [employeeToEdit, mutate]);

    const triggerRefresh = useCallback(async () => {
        await mutate();
        setRefreshTrigger((prev) => prev + 1);
    }, [mutate]);

    const value: EmployeeContextValue = {
        employees,
        currentEmployees: employees,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        currentPage,
        totalPages: pagination.totalPages,
        totalEmployees: pagination.total,
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
        fetchEmployees: triggerRefresh,
        refreshTrigger,
        triggerRefresh,
    };

    return (
        <EmployeeContext.Provider value={value}>
            {children}
        </EmployeeContext.Provider>
    );
}
