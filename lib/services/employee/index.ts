// Re-export types
export type {
    EmployeeFilters,
    UserContext,
    CreateEmployeeData,
    UpdateEmployeeData,
    CSVImportEmployee,
    ImportResult,
    ImportError,
    EmployeeWithRelations,
    PaginatedEmployeesResult,
    EmployeeMutationResult,
} from "./types";

// Import service functions
import { getEmployees, getEmployeeById, emailExists } from "./queries";
import { createEmployee, updateEmployee, deleteEmployee } from "./mutations";
import { importEmployeesFromCSV } from "./import";

/**
 * Employee Service Object
 */
export const employeeService = {
    // Query operations
    getEmployees,
    getEmployeeById,
    emailExists,

    // Mutation operations
    createEmployee,
    updateEmployee,
    deleteEmployee,

    // Import operations
    importEmployeesFromCSV,
};

// Also export individual functions for tree-shaking
export {
    // Queries
    getEmployees,
    getEmployeeById,
    emailExists,
    // Mutations
    createEmployee,
    updateEmployee,
    deleteEmployee,
    // Import
    importEmployeesFromCSV,
};
