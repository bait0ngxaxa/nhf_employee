import { type Employee, type EmployeeCSVData } from "@/types/employees";

export interface EmployeeDataContextValue {
    // Data
    employees: Employee[];
    currentEmployees: Employee[];

    // Data Stats
    totalEmployees: number;
    totalPages: number;
    isLoading: boolean;
    error: string;

    // Data Actions
    fetchEmployees: () => Promise<void>;
    refreshTrigger: number;
    triggerRefresh: () => Promise<void>;
}

export interface EmployeeUIContextValue {
    // Search & Filter State
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (filter: string) => void;

    // Pagination State & Actions
    currentPage: number;
    itemsPerPage: number;
    handlePageChange: (page: number) => void;
    handlePreviousPage: () => void;
    handleNextPage: () => void;

    // Export State & Actions
    isExporting: boolean;
    getExportData: () => EmployeeCSVData[];
    getExportFileName: () => string;
    handleExportCSV: () => Promise<EmployeeCSVData[]>;

    // Edit Modal State & Actions
    isEditFormOpen: boolean;
    employeeToEdit: Employee | null;
    showEditSuccessModal: boolean;
    lastEditedEmployee: { firstName: string; lastName: string } | null;
    handleEditEmployee: (employee: Employee) => void;
    handleCloseEditForm: () => void;
    handleEmployeeUpdate: () => void;
    setShowEditSuccessModal: (show: boolean) => void;
}

export interface EmployeeContextValue
    extends EmployeeDataContextValue, EmployeeUIContextValue {}
