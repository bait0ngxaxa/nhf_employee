"use client";

import {
    useState,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    startTransition,
    type ReactNode,
} from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { type Employee, type EmployeeCSVData } from "@/types/employees";
import { PAGINATION_DEFAULTS } from "@/constants/ui";
import {
    getEmployeeStatusLabel,
    getEmployeeEmailStatus,
} from "@/lib/helpers/employee-helpers";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { EmployeeDataContext, EmployeeUIContext } from "./EmployeeContext";
import {
    type EmployeeDataContextValue,
    type EmployeeUIContextValue,
} from "./types";

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

    const handleSearchTermChange = useCallback((value: string) => {
        startTransition(() => {
            setSearchTerm(value);
            setCurrentPage(1);
        });
    }, []);

    const handleStatusFilterChange = useCallback((value: string) => {
        startTransition(() => {
            setStatusFilter(value);
            setCurrentPage(1);
        });
    }, []);

    // UI states
    const [isExporting, setIsExporting] = useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
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

    // Keep mutate stable using ref to prevent unnecessary re-renders
    const mutateRef = useRef(mutate);
    useEffect(() => {
        mutateRef.current = mutate;
    }, [mutate]);

    // Derived data - wrapped in useMemo to prevent exhaustive-deps warning in dataValue
    const { employees, pagination, error } = useMemo(() => {
        return {
            employees: data?.employees || [],
            pagination: data?.pagination || defaultPagination,
            error: swrError
                ? swrError.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล"
                : "",
        };
    }, [data, swrError]);

    // Force refresh when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger > 0) {
            mutateRef.current();
        }
    }, [refreshTrigger]);

    const handlePageChange = useCallback((page: number) => {
        startTransition(() => {
            setCurrentPage(page);
        });
    }, []);

    const handlePreviousPage = useCallback(() => {
        startTransition(() => {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
        });
    }, []);

    const handleNextPage = useCallback(() => {
        startTransition(() => {
            setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages));
        });
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

            startTransition(() => {
                setExportData(csvData);
            });

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
            ? `${employeeToEdit.firstName} ${employeeToEdit.lastName}`
            : "พนักงาน";

        setIsEditFormOpen(false);
        setEmployeeToEdit(null);

        // Show toast notification instead of modal
        toast.success("อัปเดตข้อมูลสำเร็จ", {
            description: `ข้อมูลของ ${employeeName} ได้รับการอัปเดตเรียบร้อยแล้ว`,
        });

        mutateRef.current(); // Revalidate SWR
    }, [employeeToEdit]);

    // Stable triggerRefresh that doesn't depend on mutate identity
    const triggerRefresh = useCallback(async () => {
        await mutateRef.current();
        setRefreshTrigger((prev) => prev + 1);
    }, []);

    // Split data into stable references to reduce context updates
    // triggerRefresh is intentionally excluded - it's kept stable via ref pattern
    const dataValue = useMemo<EmployeeDataContextValue>(
        () => ({
            employees,
            currentEmployees: employees,
            totalEmployees: pagination.total,
            totalPages: pagination.totalPages,
            isLoading,
            error,
            fetchEmployees: triggerRefresh,
            refreshTrigger,
            triggerRefresh,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            employees,
            pagination.total,
            pagination.totalPages,
            isLoading,
            error,
            refreshTrigger,
        ],
    );

    // Split UI handlers into a separate memoized object to reduce dependencies
    const uiHandlers = useMemo(
        () => ({
            handleSearchTermChange,
            handleStatusFilterChange,
            handlePageChange,
            handlePreviousPage,
            handleNextPage,
            getExportData,
            getExportFileName,
            handleExportCSV,
            handleEditEmployee,
            handleCloseEditForm,
            handleEmployeeUpdate,
        }),
        [
            handleSearchTermChange,
            handleStatusFilterChange,
            handlePageChange,
            handlePreviousPage,
            handleNextPage,
            getExportData,
            getExportFileName,
            handleExportCSV,
            handleEditEmployee,
            handleCloseEditForm,
            handleEmployeeUpdate,
        ],
    );

    const uiValue = useMemo<EmployeeUIContextValue>(
        () => ({
            searchTerm,
            setSearchTerm: uiHandlers.handleSearchTermChange,
            statusFilter,
            setStatusFilter: uiHandlers.handleStatusFilterChange,
            currentPage,
            itemsPerPage,
            handlePageChange: uiHandlers.handlePageChange,
            handlePreviousPage: uiHandlers.handlePreviousPage,
            handleNextPage: uiHandlers.handleNextPage,
            isExporting,
            getExportData: uiHandlers.getExportData,
            getExportFileName: uiHandlers.getExportFileName,
            handleExportCSV: uiHandlers.handleExportCSV,
            isEditFormOpen,
            employeeToEdit,
            handleEditEmployee: uiHandlers.handleEditEmployee,
            handleCloseEditForm: uiHandlers.handleCloseEditForm,
            handleEmployeeUpdate: uiHandlers.handleEmployeeUpdate,
        }),
        // Reduce dependencies - only state values that change
        [
            searchTerm,
            statusFilter,
            currentPage,
            itemsPerPage,
            isExporting,
            isEditFormOpen,
            employeeToEdit,
            uiHandlers,
        ],
    );

    return (
        <EmployeeDataContext.Provider value={dataValue}>
            <EmployeeUIContext.Provider value={uiValue}>
                {children}
            </EmployeeUIContext.Provider>
        </EmployeeDataContext.Provider>
    );
}
