import { type Employee, type EmployeeCSVData } from "@/types/employees";

export interface EmployeeContextValue {
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
    refreshTrigger: number;
    triggerRefresh: () => Promise<void>;
}
