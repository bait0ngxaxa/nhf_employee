import { useState, useEffect, useCallback } from "react";
import { Employee, EmployeeCSVData } from "@/types/employees";
import { PAGINATION_DEFAULTS } from "@/constants/ui";
import {
    getEmployeeStatusLabel,
    getEmployeeEmailStatus,
} from "@/lib/helpers/employee-helpers";
import { generateFilename } from "@/lib/helpers/date-helpers";

interface UseEmployeeListReturn {
    // Data
    employees: Employee[];
    filteredEmployees: Employee[];
    currentEmployees: Employee[];

    // Search & Filter
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (filter: string) => void;

    // Pagination
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    startIndex: number;
    endIndex: number;
    handlePageChange: (page: number) => void;
    handlePreviousPage: () => void;
    handleNextPage: () => void;

    // Loading & Error
    isLoading: boolean;
    error: string;

    // Export
    isExporting: boolean;
    prepareCsvData: () => EmployeeCSVData[];
    getExportFileName: () => string;
    handleExportCSV: () => void;

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
 * Custom hook for managing employee list state and actions
 * Extracts business logic from EmployeeList component
 */
export function useEmployeeList(
    refreshTrigger?: number
): UseEmployeeListReturn {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(PAGINATION_DEFAULTS.ITEMS_PER_PAGE);
    const [isExporting, setIsExporting] = useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
    const [showEditSuccessModal, setShowEditSuccessModal] = useState(false);
    const [lastEditedEmployee, setLastEditedEmployee] = useState<{
        firstName: string;
        lastName: string;
    } | null>(null);

    // Pagination calculations
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

    const fetchEmployees = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/employees");

            if (response.ok) {
                const data = await response.json();
                setEmployees(data.employees);
                setFilteredEmployees(data.employees);
                setError("");
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
    }, []);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees, refreshTrigger]);

    useEffect(() => {
        const filtered = employees.filter((employee) => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                employee.firstName.toLowerCase().includes(searchLower) ||
                employee.lastName.toLowerCase().includes(searchLower) ||
                (employee.nickname &&
                    employee.nickname.toLowerCase().includes(searchLower)) ||
                employee.email.toLowerCase().includes(searchLower) ||
                employee.position.toLowerCase().includes(searchLower) ||
                employee.dept.name.toLowerCase().includes(searchLower) ||
                (employee.affiliation &&
                    employee.affiliation.toLowerCase().includes(searchLower));

            const matchesStatus =
                statusFilter === "all" || employee.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
        setFilteredEmployees(filtered);
        setCurrentPage(1);
    }, [searchTerm, statusFilter, employees]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePreviousPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    const prepareCsvData = (): EmployeeCSVData[] => {
        return filteredEmployees.map((employee, index) => ({
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

    const handleExportCSV = () => {
        setIsExporting(true);
        setTimeout(() => setIsExporting(false), 1000);
    };

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
        fetchEmployees,
    };
}
