import { useState, useEffect, useCallback } from "react";
import { Employee, EmployeeCSVData } from "@/types/employees";
import { PAGINATION_DEFAULTS } from "@/constants/ui";
import {
    getEmployeeStatusLabel,
    getEmployeeEmailStatus,
} from "@/lib/helpers/employee-helpers";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface UseEmployeeListReturn {
    // Data
    employees: Employee[];
    currentEmployees: Employee[];

    // Search & Filter
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (filter: string) => void;

    // Pagination
    currentPage: number;
    totalPages: number;
    totalEmployees: number;
    itemsPerPage: number;
    handlePageChange: (page: number) => void;
    handlePreviousPage: () => void;
    handleNextPage: () => void;

    // Loading & Error
    isLoading: boolean;
    error: string;

    // Export
    isExporting: boolean;
    getExportData: () => EmployeeCSVData[];
    getExportFileName: () => string;
    handleExportCSV: () => Promise<EmployeeCSVData[]>;

    // Edit
    isEditFormOpen: boolean;
    employeeToEdit: Employee | null;
    showEditSuccessModal: boolean;
    lastEditedEmployee: { firstName: string; lastName: string } | null;
    handleEditEmployee: (employee: Employee) => void;
    handleCloseEditForm: () => void;
    handleEmployeeUpdate: () => void;
    setShowEditSuccessModal: (show: boolean) => void;

    // Actions
    fetchEmployees: () => Promise<void>;
}

/**
 * Custom hook for managing employee list state with server-side pagination
 */
export function useEmployeeList(
    refreshTrigger?: number
): UseEmployeeListReturn {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(PAGINATION_DEFAULTS.ITEMS_PER_PAGE);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE,
        total: 0,
        totalPages: 0,
    });
    const [isExporting, setIsExporting] = useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
    const [showEditSuccessModal, setShowEditSuccessModal] = useState(false);
    const [lastEditedEmployee, setLastEditedEmployee] = useState<{
        firstName: string;
        lastName: string;
    } | null>(null);

    // Debounce search to avoid too many API calls
    const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

    const fetchEmployees = useCallback(async () => {
        try {
            setIsLoading(true);
            setError("");

            // Build query params
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

            const response = await fetch(`/api/employees?${params}`);

            if (response.ok) {
                const data = await response.json();
                setEmployees(data.employees);
                setPagination(data.pagination);
            } else {
                const errorData = await response.json();
                setError(errorData.error || "เกิดข้อผิดพลาดในการดึงข้อมูล");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
            console.error("Error fetching employees:", err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm, statusFilter]);

    // Fetch when dependencies change
    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees, refreshTrigger]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePreviousPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages));
    };
    // Export: need to fetch all matching employees, not just current page
    const [exportData, setExportData] = useState<EmployeeCSVData[]>([]);

    const fetchAllForExport = useCallback(async (): Promise<Employee[]> => {
        const params = new URLSearchParams({
            page: "1",
            limit: "10000", // Get all
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

    const getExportFileName = () => {
        const searchSuffix = searchTerm ? `_ค้นหา-${searchTerm}` : "";
        const statusSuffix =
            statusFilter !== "all"
                ? `_สถานะ-${getEmployeeStatusLabel(statusFilter)}`
                : "";
        const prefix = `รายชื่อพนักงาน${searchSuffix}${statusSuffix}`;
        return generateFilename(prefix, "csv");
    };

    const handleExportCSV = async (): Promise<EmployeeCSVData[]> => {
        setIsExporting(true);
        try {
            const allEmployees = await fetchAllForExport();
            const csvData = prepareCsvData(allEmployees);
            setExportData(csvData);

            // Log audit event for data export
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
    };

    const getExportData = () => exportData;

    const handleEditEmployee = (employee: Employee) => {
        setEmployeeToEdit(employee);
        setIsEditFormOpen(true);
    };

    const handleCloseEditForm = () => {
        setIsEditFormOpen(false);
        setEmployeeToEdit(null);
    };

    const handleEmployeeUpdate = () => {
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

        fetchEmployees();
    };

    return {
        employees,
        currentEmployees: employees, // Server already returns paginated data
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
        fetchEmployees,
    };
}
